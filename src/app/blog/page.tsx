import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, CardContent, Chip, Container, Grid, Stack, Typography } from '@mui/material';
import { PublicNavbar } from '@/components/public/public-navbar';
import { PublicFooter } from '@/components/public/public-footer';
import { blogPosts } from '@/components/public/blog-content';
import { formatDateDMY } from '@/lib/utils/date-format';

export const metadata: Metadata = {
  title: 'บทความ | ระบบจองคิวผ่าน LINE OA | QueueBooking LINE',
  description: 'บทความเกี่ยวกับระบบจองคิวผ่าน LINE OA, LIFF, การลด no-show และแนวทางเพิ่มประสิทธิภาพงานบริการ',
  alternates: {
    canonical: '/blog',
    languages: {
      'th-TH': '/blog',
      'en-US': '/en/blog',
      'x-default': '/blog',
    },
  },
};

export default function BlogPage() {
  return (
    <main>
      <PublicNavbar />
      <Container maxWidth="lg" sx={{ py: 8 }}>
        <Typography variant="h3" fontWeight={800}>บทความและแนวทางใช้งานระบบจองคิว</Typography>
        <Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>
          รวมวิธีใช้งานจริงและ best practices สำหรับธุรกิจบริการที่ใช้ LINE OA
        </Typography>

        <Grid container spacing={2}>
          {blogPosts.map((post) => (
            <Grid key={post.slug} size={{ xs: 12, md: 6 }}>
              <Card sx={{ borderRadius: 1, height: '100%' }}>
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                    <Chip label={post.category} size="small" />

                    <Typography variant="caption" color="text.secondary">



                      {formatDateDMY(post.publishedAt)} • {post.readingMinutes} นาที
                    </Typography>
                  </Stack>
                  <Link href={`/blog/${post.slug}`}>
                   <Typography variant="h6" fontWeight={700}>{post.title}</Typography>
                  </Link>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{post.description}</Typography>
                  <Stack direction="row" spacing={1} sx={{ mt: 1.4, flexWrap: 'wrap' }}>
                    {post.keywords.slice(0, 3).map((k) => <Chip key={k} label={k} size="small" variant="outlined" />)}
                  </Stack>
                  <Typography sx={{ mt: 1.8 }}>
                    <Link href={`/blog/${post.slug}`}>อ่านบทความ</Link>
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>
      <PublicFooter />
    </main>
  );
}
