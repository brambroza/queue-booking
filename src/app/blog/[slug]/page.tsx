import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import { Box, Button, Chip, Container, Divider, Paper, Stack, Typography } from '@mui/material';
import { PublicNavbar } from '@/components/public/public-navbar';
import { PublicFooter } from '@/components/public/public-footer';
import { blogPosts, getBlogBySlug } from '@/components/public/blog-content';
import { formatDateDMY } from '@/lib/utils/date-format';

type Params = { slug: string };

export function generateStaticParams() {
  return blogPosts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogBySlug(slug);
  if (!post) return {};
  return {
    title: `${post.title} | LINE Queue Booking SaaS`,
    description: post.description,
    alternates: {
      canonical: `/blog/${post.slug}`,
      languages: {
        'th-TH': `/blog/${post.slug}`,
        'en-US': `/en/blog/${post.slug}`,
        'x-default': `/blog/${post.slug}`,
      },
    },
    openGraph: {
      title: post.title,
      description: post.description,
      url: `/blog/${post.slug}`,
      type: 'article',
      locale: 'th_TH',
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
    dateModified: `${post.publishedAt}T00:00:00+07:00`,
    inLanguage: 'th-TH',
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

  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <PublicNavbar />
      <Container maxWidth="md" sx={{ py: 8 }}>
        <Stack spacing={1}>
          <Chip label={post.category} size="small" sx={{ width: 'fit-content' }} />
          <Typography variant="h3" fontWeight={800}>{post.title}</Typography>
          <Typography color="text.secondary">
            {formatDateDMY(post.publishedAt)} • เวลาอ่านประมาณ {post.readingMinutes} นาที
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
                    bgcolor: '#fff',
                  }}
                >
                  <Box sx={{ position: 'relative', width: '100%', height: { xs: 180, md: 320 } }}>
                    <Image src={img.src} alt={img.alt} fill style={{ objectFit: 'cover' }} />
                  </Box>
                  <Box sx={{ p: 1.5 }}>
                    <Typography variant="body2" color="text.secondary">{img.caption}</Typography>
                  </Box>
                </Box>
              ))}
            </Stack>
          </Paper>
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
      <PublicFooter />
    </main>
  );
}
