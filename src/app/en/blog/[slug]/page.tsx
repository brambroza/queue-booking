import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Box, Chip, Container, Divider, Stack, Typography } from '@mui/material';
import { PublicNavbar } from '@/components/public/public-navbar';
import { PublicFooter } from '@/components/public/public-footer';
import { blogPostsEn, getBlogBySlugEn } from '@/components/public/blog-content-en';
import { formatDateDMY } from '@/lib/utils/date-format';

type Params = { slug: string };

export function generateStaticParams() {
  return blogPostsEn.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogBySlugEn(slug);
  if (!post) return {};
  return {
    title: `${post.title} | LINE Queue Booking SaaS`,
    description: post.description,
    alternates: {
      canonical: `/en/blog/${post.slug}`,
      languages: {
        'th-TH': `/blog/${post.slug}`,
        'en-US': `/en/blog/${post.slug}`,
        'x-default': `/blog/${post.slug}`,
      },
    },
    openGraph: {
      title: post.title,
      description: post.description,
      url: `/en/blog/${post.slug}`,
      type: 'article',
      locale: 'en_US',
    },
  };
}

export default async function BlogDetailEnPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const post = getBlogBySlugEn(slug);
  if (!post) notFound();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://queue-booking-line.vercel.app';
  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.description,
    datePublished: `${post.publishedAt}T00:00:00+07:00`,
    dateModified: `${post.publishedAt}T00:00:00+07:00`,
    inLanguage: 'en-US',
    author: {
      '@type': 'Organization',
      name: 'QueueBooking LINE',
    },
    publisher: {
      '@type': 'Organization',
      name: 'QueueBooking LINE',
    },
    mainEntityOfPage: `${appUrl}/en/blog/${post.slug}`,
  };

  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <PublicNavbar />
      <Container maxWidth="md" sx={{ py: 8 }}>
        <Stack spacing={1}>
          <Chip label={post.category} size="small" sx={{ width: 'fit-content' }} />
          <Typography variant="h3" fontWeight={800}>{post.title}</Typography>
          <Typography color="text.secondary">
            {formatDateDMY(post.publishedAt)} • {post.readingMinutes} min read
          </Typography>
        </Stack>
        <Divider sx={{ my: 3 }} />

        <Stack spacing={3}>
          {post.sections.map((s) => (
            <Box key={s.heading}>
              <Typography variant="h5" fontWeight={700} sx={{ mb: 1.2 }}>{s.heading}</Typography>
              <Stack spacing={1.2}>
                {s.body.map((p) => (
                  <Typography key={p} color="text.secondary">{p}</Typography>
                ))}
              </Stack>
            </Box>
          ))}
        </Stack>

        <Box sx={{ mt: 4 }}>
          <Typography>
            <Link href="/register">Start free trial</Link> or <Link href="/en/contact">Contact sales</Link>
          </Typography>
          <Typography sx={{ mt: 1 }}>
            <Link href="/en/blog">← Back to all articles</Link>
          </Typography>
        </Box>
      </Container>
      <PublicFooter />
    </main>
  );
}

