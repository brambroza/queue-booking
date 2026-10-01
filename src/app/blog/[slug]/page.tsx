import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import { Box, Button, Chip, Container, Divider, Paper, Stack, Typography } from '@mui/material';
import { LandingNavbar } from '@/components/public/landing-navbar';
import { LandingFooter } from '@/components/public/landing-footer';
import { blogPosts, getBlogBySlug } from '@/components/public/blog-content';
import { getBlogBySlugEn } from '@/components/public/blog-content-en';
import { formatDateDMY } from '@/lib/utils/date-format';

type Params = { slug: string };

export function generateStaticParams() {
  return blogPosts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogBySlug(slug);
  if (!post) return {};
  // Point hreflang at the English page only when it exists; a missing
  // translation used to send crawlers to a 404.
  const hasEn = getBlogBySlugEn(post.slug) !== null;
  const ogImage = post.assets?.images?.[0]?.src;
  return {
    title: `${post.title} | ระบบจองคิวผ่าน LINE OA | QueueBooking LINE`,
    description: post.description,
    keywords: post.keywords,
    alternates: {
      canonical: `/blog/${post.slug}`,
      languages: {
        'th-TH': `/blog/${post.slug}`,
        ...(hasEn ? { 'en-US': `/en/blog/${post.slug}` } : {}),
        'x-default': `/blog/${post.slug}`,
      },
    },
    openGraph: {
      title: post.title,
      description: post.description,
      url: `/blog/${post.slug}`,
      type: 'article',
      locale: 'th_TH',
      publishedTime: `${post.publishedAt}T00:00:00+07:00`,
      modifiedTime: `${post.updatedAt ?? post.publishedAt}T00:00:00+07:00`,
      ...(ogImage ? { images: [{ url: ogImage, alt: post.assets?.images?.[0]?.alt }] } : {}),
    },
  };
}

export default async function BlogDetailPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const post = getBlogBySlug(slug);
  if (!post) notFound();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://queuebooking.com';
  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.description,
    datePublished: `${post.publishedAt}T00:00:00+07:00`,
    dateModified: `${post.updatedAt ?? post.publishedAt}T00:00:00+07:00`,
    inLanguage: 'th-TH',
    keywords: post.keywords.join(', '),
    articleSection: post.category,
    ...(post.assets?.images?.length
      ? { image: post.assets.images.map((img) => `${appUrl}${img.src}`) }
      : {}),
    author: {
      '@type': 'Organization',
      name: 'QueueBooking LINE',
    },
    publisher: {
      '@type': 'Organization',
      name: 'QueueBooking LINE',
    },
    mainEntityOfPage: `${appUrl}/blog/${post.slug}`,
  };
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'หน้าแรก', item: `${appUrl}/` },
      { '@type': 'ListItem', position: 2, name: 'บทความ', item: `${appUrl}/blog` },
      { '@type': 'ListItem', position: 3, name: post.title, item: `${appUrl}/blog/${post.slug}` },
    ],
  };
  const faqSchema = post.faqs?.length
    ? {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: post.faqs.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      }
    : null;

  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      {faqSchema ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      ) : null}
      <LandingNavbar />
      <Container maxWidth="md" sx={{ py: 8 }}>
        <Stack spacing={1}>
          <Chip label={post.category} size="small" sx={{ width: 'fit-content' }} />
          <Typography variant="h3" fontWeight={800}>{post.title}</Typography>
          <Typography color="text.secondary">
            {formatDateDMY(post.publishedAt)}
            {post.updatedAt && post.updatedAt !== post.publishedAt
              ? ` • ปรับปรุง ${formatDateDMY(post.updatedAt)}`
              : ''}
            {' '}• เวลาอ่านประมาณ {post.readingMinutes} นาที
          </Typography>
        </Stack>
        <Divider sx={{ my: 3 }} />

        {post.summary ? (
          <Paper
            elevation={0}
            sx={{ p: { xs: 2, md: 2.5 }, mb: 4, borderRadius: 2, bgcolor: '#f3faf5', border: '1px solid #cfe8d6' }}
          >
            <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 0.5 }}>สรุปสั้น</Typography>
            <Typography>{post.summary}</Typography>
          </Paper>
        ) : null}

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

        {post.assets?.pdfUrl || (post.assets?.images?.length ?? 0) > 0 ? (
          <Paper
            sx={{
              mt: 4,
              p: { xs: 2, md: 3 },
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
              background: 'linear-gradient(135deg,#fff 0%,#f8fbf8 100%)',
            }}
          >
            <Typography variant="h5" fontWeight={800}>ไฟล์แนบและภาพตัวอย่างการตั้งค่า</Typography>
            <Typography color="text.secondary" sx={{ mt: 0.5 }}>
              ใช้ภาพตัวอย่างตรวจเทียบค่าหน้าจอจริงก่อนกด Verify/Publish
            </Typography>

            {post.assets?.pdfUrl ? (
              <Button
                component={Link}
                href={post.assets.pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                variant="contained"
                sx={{ mt: 2 }}
              >
                {post.assets.pdfLabel ?? 'ดาวน์โหลดไฟล์ PDF'}
              </Button>
            ) : null}

            <Stack spacing={2} sx={{ mt: 2.5 }}>
              {post.assets?.images?.map((img) => (
                <Box
                  key={img.src}
                  sx={{
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 2,
                    overflow: 'hidden',
                    bgcolor: '#fcfdfc',
                  }}
                >
                  <Box sx={{ p: { xs: 1.2, md: 1.8 } }}>
                    <Box
                      sx={{
                        border: '1px solid',
                        borderColor: '#e6ece8',
                        borderRadius: 1.5,
                        overflow: 'hidden',
                        bgcolor: '#fff',
                      }}
                    >
                      <Image
                        src={img.src}
                        alt={img.alt}
                        width={1600}
                        height={1200}
                        style={{ width: '100%', height: 'auto', display: 'block' }}
                      />
                    </Box>
                  </Box>
                  <Box sx={{ px: { xs: 1.2, md: 1.8 }, pb: { xs: 1.2, md: 1.6 }, pt: 0.2 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.65 }}>
                      {img.caption}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Stack>
          </Paper>
        ) : null}

        {post.faqs?.length ? (
          <Box sx={{ mt: 5 }}>
            <Typography variant="h5" fontWeight={700} sx={{ mb: 2 }}>คำถามที่พบบ่อย</Typography>
            <Stack spacing={2}>
              {post.faqs.map((f) => (
                <Box key={f.q}>
                  <Typography variant="h6" component="h3" fontWeight={700} sx={{ fontSize: '1.05rem' }}>{f.q}</Typography>
                  <Typography color="text.secondary" sx={{ mt: 0.5 }}>{f.a}</Typography>
                </Box>
              ))}
            </Stack>
          </Box>
        ) : null}

        <Box sx={{ mt: 4 }}>
          <Typography>
            <Link href="/register">เริ่มใช้งานฟรี</Link> หรือ <Link href="/contact">ปรึกษาทีมงาน</Link>
          </Typography>
          <Typography sx={{ mt: 1 }}>
            <Link href="/blog">← กลับไปหน้าบทความทั้งหมด</Link>
          </Typography>
        </Box>
      </Container>
      <LandingFooter />
    </main>
  );
}
