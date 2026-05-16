import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { Box, Button, Card, CardContent, Container, Grid, Stack, Typography } from '@mui/material';
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
    alternates: {
      canonical: `/use-cases/${found.slug}`,
      languages: {
        'th-TH': `/use-cases/${found.slug}`,
        'en-US': `/en/use-cases/${found.slug}`,
        'x-default': `/use-cases/${found.slug}`,
      },
    },
  };
}

export default async function UseCaseDetailPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const item = useCases.find((u) => u.slug === slug);
  if (!item) notFound();
  const Icon = item.icon;
  const isBarber = item.slug === 'barber-shop';

  return (
    <main>
      <PublicNavbar />
      <Container maxWidth="md" sx={{ py: 8 }}>
        <Stack direction="row" spacing={1.2} alignItems="center" sx={{ mb: 2 }}>
          <Box sx={{ width: 44, height: 44, borderRadius: 1, bgcolor: '#eaf3de', display: 'grid', placeItems: 'center' }}>
            <Icon sx={{ color: '#639922' }} />
          </Box>
          <div>
            <Typography variant="h4" fontWeight={800}>{item.title}</Typography>
            <Typography color="text.secondary">{item.mode}</Typography>
          </div>
        </Stack>

        <Card sx={{ borderRadius: 1 }}>
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

        {isBarber ? (
          <Stack spacing={2} sx={{ mt: 2.5 }}>
            <Card sx={{ borderRadius: 2, border: '1px solid #dce6df', boxShadow: 'none' }}>
              <CardContent>
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#6a7a6c', letterSpacing: 0.3 }}>ตัวอย่างหน้าจอ</Typography>
                <Typography variant="h6" fontWeight={800} sx={{ mt: 0.2 }}>มุมลูกค้า</Typography>
                <Typography color="text.secondary" sx={{ mt: 0.6 }}>
                  ลูกค้าเลือกบริการ เลือกช่าง เลือกวันเวลาใน LIFF และรับ Flex ยืนยันการจองในแชท LINE ทันที
                </Typography>
                <Grid container spacing={1.2} sx={{ mt: 0.6 }}>
                  {[
                    { src: '/images/use-cases/barber/liff-step-1.jpg', title: 'Step 1: เลือกบริการ + เลือกช่าง' },
                    { src: '/images/use-cases/barber/liff-step-2.jpg', title: 'Step 2: เลือกวันเวลา' },
                    { src: '/images/use-cases/barber/liff-time-slots.jpg', title: 'เลือกช่วงเวลาว่าง' },
                    { src: '/images/use-cases/barber/line-flex-success.png', title: 'Flex Message ยืนยันการจอง' },
                  ].map((img) => (
                    <Grid key={img.src} size={{ xs: 12, sm: 6 }}>
                      <Box sx={{ border: '1px solid #dce6df', borderRadius: 2, overflow: 'hidden', bgcolor: '#f7faf8' }}>
                        <Box sx={{ p: 1 }}>
                          <Box sx={{ border: '1px solid #d8e6dc', borderRadius: 2, overflow: 'hidden', bgcolor: '#fff' }}>
                            <Image src={img.src} alt={img.title} width={900} height={1600} style={{ width: '100%', height: 'auto', display: 'block' }} />
                          </Box>
                        </Box>
                        <Typography variant="caption" sx={{ display: 'block', px: 1.2, py: 0.9, color: 'text.secondary', borderTop: '1px solid #e7efe9' }}>{img.title}</Typography>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              </CardContent>
            </Card>

            <Card sx={{ borderRadius: 2, border: '1px solid #dce6df', boxShadow: 'none' }}>
              <CardContent>
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#6a7a6c', letterSpacing: 0.3 }}>ตัวอย่างหน้าจอ</Typography>
                <Typography variant="h6" fontWeight={800} sx={{ mt: 0.2 }}>มุมร้าน</Typography>
                <Typography color="text.secondary" sx={{ mt: 0.6 }}>
                  หลังบ้านเห็นการแจ้งเตือนคิวใหม่, มุมมองปฏิทินรายเดือน, รายละเอียดคิวรายวัน และหน้าจอเรียกคิว (Digital Signage)
                </Typography>
                <Grid container spacing={1.2} sx={{ mt: 0.6 }}>
                  {[
                    { src: '/images/use-cases/barber/notification-dropdown.jpg', title: 'Notification: แจ้งเตือนคิวใหม่' },
                    { src: '/images/use-cases/barber/calendar-view.jpg', title: 'Calendar: ภาพรวมคิวทั้งเดือน' },
                    { src: '/images/use-cases/barber/daily-queue-list.jpg', title: 'รายการคิวรายวัน + สถานะคิว' },
                    { src: '/images/use-cases/barber/signage-desktop.jpg', title: 'Digital Signage: เรียกคิวหน้าร้าน' },
                  ].map((img) => (
                    <Grid key={img.src} size={{ xs: 12, sm: 6 }}>
                      <Box sx={{ border: '1px solid #dce6df', borderRadius: 2, overflow: 'hidden', bgcolor: '#f7faf8' }}>
                        <Box sx={{ p: 1 }}>
                          <Box sx={{ border: '1px solid #d8e6dc', borderRadius: 2, overflow: 'hidden', bgcolor: '#fff' }}>
                            <Image src={img.src} alt={img.title} width={1200} height={900} style={{ width: '100%', height: 'auto', display: 'block' }} />
                          </Box>
                        </Box>
                        <Typography variant="caption" sx={{ display: 'block', px: 1.2, py: 0.9, color: 'text.secondary', borderTop: '1px solid #e7efe9' }}>{img.title}</Typography>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              </CardContent>
            </Card>
          </Stack>
        ) : null}
      </Container>
      <PublicFooter />
    </main>
  );
}
