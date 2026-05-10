import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Box, Button, Card, CardContent, Container, Stack, Typography } from '@mui/material';
import { PublicNavbar } from '@/components/public/public-navbar';
import { PublicFooter } from '@/components/public/public-footer';
import { useCases } from '@/components/public/content';

type Params = { slug: string };

export function generateStaticParams() {
  return useCases.map((u) => ({ slug: u.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const found = useCases.find((u) => u.slug === slug);
  if (!found) return {};
  return {
    title: `${found.title} | ระบบจองคิวผ่าน LINE OA`,
    description: `${found.title}: ${found.summary}`,
    alternates: { canonical: `/use-cases/${found.slug}` },
  };
}

export default async function UseCaseDetailPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const item = useCases.find((u) => u.slug === slug);
  if (!item) notFound();
  const Icon = item.icon;

  return (
    <main>
      <PublicNavbar />
      <Container maxWidth="md" sx={{ py: 8 }}>
        <Stack direction="row" spacing={1.2} alignItems="center" sx={{ mb: 2 }}>
          <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: '#eaf3de', display: 'grid', placeItems: 'center' }}>
            <Icon sx={{ color: '#639922' }} />
          </Box>
          <div>
            <Typography variant="h4" fontWeight={800}>{item.title}</Typography>
            <Typography color="text.secondary">{item.mode}</Typography>
          </div>
        </Stack>

        <Card sx={{ borderRadius: 3 }}>
          <CardContent>
            <Typography variant="body1" color="text.secondary">{item.summary}</Typography>
            <Typography fontWeight={700} sx={{ mt: 2 }}>ตัวอย่างบริการที่แนะนำ</Typography>
            <Stack spacing={0.8} sx={{ mt: 1 }}>
              {item.services.map((s) => (
                <Typography key={s}>• {s}</Typography>
              ))}
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2} sx={{ mt: 3 }}>
              <Button component={Link} href="/register" variant="contained">เริ่มใช้งานฟรี</Button>
              <Button component={Link} href="/contact" variant="outlined">ปรึกษาทีมงาน</Button>
              <Button component={Link} href="/use-cases" variant="text">กลับหน้าตัวอย่างธุรกิจ</Button>
            </Stack>
          </CardContent>
        </Card>
      </Container>
      <PublicFooter />
    </main>
  );
}

