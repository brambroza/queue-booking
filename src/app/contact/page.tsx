import type { Metadata } from 'next';
import { Box, Container, Grid, Paper, Stack, Typography } from '@mui/material';
import { PublicFooter } from '@/components/public/public-footer';
import { PublicNavbar } from '@/components/public/public-navbar';
import { ContactForm } from '@/components/public/contact-form';
import { FaqSection } from '@/components/public/faq-section';
import { faqs } from '@/components/public/content';

export const metadata: Metadata = {
  title: 'ติดต่อเรา | LINE Queue Booking SaaS',
  description:
    'ติดต่อทีมงานเพื่อเริ่มใช้งานระบบจองคิวผ่าน LINE OA สำหรับธุรกิจของคุณ',
  alternates: { canonical: '/contact' },
  openGraph: {
    title: 'ติดต่อเรา | LINE Queue Booking SaaS',
    description: 'ติดต่อทีมงานเพื่อรับเดโมและเริ่มใช้งานระบบจองคิวผ่าน LINE OA',
    url: '/contact',
    type: 'website',
    locale: 'th_TH',
  },
};

export default function ContactPage() {
  return (
    <main>
      <PublicNavbar />
      <Container maxWidth="xl" sx={{ py: 8 }}>
        <Typography variant="h3" fontWeight={800}>ติดต่อเรา</Typography>
        <Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>หากต้องการเดโมหรือคำแนะนำการเริ่มใช้งาน ทีมงานพร้อมช่วยทันที</Typography>

        <Grid container spacing={2.5}>
          <Grid size={{ xs: 12, md: 7 }}>
            <Paper sx={{ p: 3, borderRadius: 3 }}><ContactForm /></Paper>
          </Grid>
          <Grid size={{ xs: 12, md: 5 }}>
            <Paper sx={{ p: 3, borderRadius: 3 }}>
              <Stack spacing={1.2}>
                <Typography variant="h6" fontWeight={700}>ข้อมูลบริษัท</Typography>
                <Typography variant="body2">Phone: 085-608-3298</Typography>
                <Typography variant="body2">Email: amnart.gl@gmail.com</Typography>
                <Typography variant="body2">LINE OA: 0856083298</Typography>
                <Typography variant="body2">Address: Bangkok, Thailand</Typography>
                <Box sx={{ mt: 1, p: 2, borderRadius: 2, bgcolor: '#f4f6f8', textAlign: 'center' }}>
                  <Typography variant="caption" color="text.secondary">Google Map Placeholder</Typography>
                </Box>
              </Stack>
            </Paper>
          </Grid>
        </Grid>
      </Container>
      <FaqSection items={faqs.slice(0, 3)} />
      <PublicFooter />
    </main>
  );
}
