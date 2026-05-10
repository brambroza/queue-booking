import type { Metadata } from 'next';
import Link from 'next/link';
import { Box, Card, CardContent, Container, Grid, Stack, Typography } from '@mui/material';
import { PublicNavbar } from '@/components/public/public-navbar';
import { PublicFooter } from '@/components/public/public-footer';
import { useCases } from '@/components/public/content';

export const metadata: Metadata = {
  title: 'ตัวอย่างการใช้งาน | LINE Queue Booking SaaS',
  description: 'ตัวอย่างธุรกิจที่ใช้ระบบจองคิวผ่าน LINE OA เช่น ร้านตัดผม คลินิก ร้านอาหาร และศูนย์บริการ',
  alternates: { canonical: '/use-cases' },
};

export default function UseCasesPage() {
  return (
    <main>
      <PublicNavbar />
      <Container maxWidth="xl" sx={{ py: 8 }}>
        <Typography variant="h3" fontWeight={800}>ตัวอย่างการใช้งานตามประเภทธุรกิจ</Typography>
        <Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>
          เลือกรูปแบบคิวและบริการที่เหมาะกับธุรกิจของคุณ พร้อมเริ่มใช้งานได้ทันที
        </Typography>

        <Grid container spacing={2}>
          {useCases.map((item) => {
            const Icon = item.icon;
            return (
              <Grid key={item.slug} size={{ xs: 12, md: 6, lg: 4 }}>
                <Card sx={{ borderRadius: 3, height: '100%' }}>
                  <CardContent>
                    <Stack direction="row" spacing={1.2} alignItems="center">
                      <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: '#eaf3de', display: 'grid', placeItems: 'center' }}>
                        <Icon sx={{ color: '#639922' }} />
                      </Box>
                      <Typography fontWeight={700}>{item.title}</Typography>
                    </Stack>
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                      {item.mode}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1.2 }}>
                      {item.summary}
                    </Typography>
                    <Stack spacing={0.4} sx={{ mt: 1.2 }}>
                      {item.services.map((s) => (
                        <Typography key={s} variant="body2">• {s}</Typography>
                      ))}
                    </Stack>
                    <Box sx={{ mt: 1.8 }}>
                      <Link href={`/use-cases/${item.slug}`}>ดูรายละเอียดเพิ่มเติม</Link>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      </Container>
      <PublicFooter />
    </main>
  );
}

