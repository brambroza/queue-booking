import type { Metadata } from 'next';
import Link from 'next/link';
import { Box, Button, Container, Grid, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { PublicFooter } from '@/components/public/public-footer';
import { PublicNavbar } from '@/components/public/public-navbar';
import { faqs, featureCompare } from '@/components/public/content';
import { FaqSection } from '@/components/public/faq-section';
import { PricingCard } from '@/components/public/pricing-card';

export const metadata: Metadata = {
  title: 'แผนราคา | ระบบจองคิวผ่าน LINE OA | ลูกค้าจองคิวเอง | ระบบจองคิว',
  description:
    'เลือกแผนการใช้งานระบบจองคิวผ่าน LINE OA สำหรับร้านค้า คลินิก ร้านอาหาร ศูนย์บริการ | ระบบจองคิวผ่าน LINE OA | QueueBooking LINE',
  alternates: {
    canonical: '/pricing',
    languages: {
      'th-TH': '/pricing',
      'en-US': '/en/pricing',
      'x-default': '/pricing',
    },
  },
  openGraph: {
    title: 'แผนราคา | ระบบจองคิวผ่าน LINE OA | ลูกค้าจองคิวเอง | ระบบจองคิว',
    description: 'เลือกแผนการใช้งานระบบจองคิวผ่าน LINE OA ให้เหมาะกับธุรกิจของคุณ',
    url: '/pricing',
    type: 'website',
    locale: 'th_TH',
  },
};

export default function PricingPage() {
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: f.a,
      },
    })),
  };

  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <PublicNavbar />
      <Container maxWidth="xl" sx={{ py: 8 }}>
        <Typography variant="h3" fontWeight={800}>Pricing Plans</Typography>
        <Typography color="text.secondary" sx={{ mt: 1 }}>โปรโมชันตอนนี้: Starter ฟรี 3 เดือน (100 bookings/เดือน)</Typography>

        <Grid container spacing={2} sx={{ mt: 1 }}>
          <Grid size={{ xs: 12, md: 4 }}><PricingCard name="Free Trial" price="0 บาท" period="/14 วัน" items={['ทดสอบระบบ', '1 ร้าน', '1 สาขา', '1 บริการ', '50 bookings']} /></Grid>
          <Grid size={{ xs: 12, md: 4 }}><PricingCard name="Starter" price="ฟรี 3 เดือน" items={['1 ร้าน', '1 สาขา', '3 บริการ', '100 bookings/เดือน']} /></Grid>
          <Grid size={{ xs: 12, md: 4 }}><PricingCard name="Professional" price="1,490 บาท" items={['1 ร้าน', '5 สาขา', 'ไม่จำกัดบริการ', '2,000 bookings/เดือน', 'LINE Auto Reply']} highlight /></Grid>
          <Grid size={{ xs: 12, md: 6 }}><PricingCard name="Business" price="3,990 บาท" items={['หลายร้าน / หลายสาขา', 'ไม่จำกัดบริการ', '10,000 bookings/เดือน', 'Chat Inbox', 'Advanced Reports']} /></Grid>
          <Grid size={{ xs: 12, md: 6 }}><PricingCard name="Enterprise" price="ติดต่อฝ่ายขาย" period="" items={['Custom features', 'Dedicated support', 'SLA', 'On-premise option']} /></Grid>
        </Grid>

        <Paper sx={{ mt: 4, borderRadius: 3, overflow: 'hidden' }}>
          <Table>
            <TableHead><TableRow><TableCell>Feature</TableCell><TableCell>Trial</TableCell><TableCell>Starter</TableCell><TableCell>Professional</TableCell><TableCell>Business</TableCell><TableCell>Enterprise</TableCell></TableRow></TableHead>
            <TableBody>{featureCompare.map((r) => <TableRow key={r.key}><TableCell>{r.key}</TableCell><TableCell>{r.trial}</TableCell><TableCell>{r.starter}</TableCell><TableCell>{r.pro}</TableCell><TableCell>{r.business}</TableCell><TableCell>{r.enterprise}</TableCell></TableRow>)}</TableBody>
          </Table>
        </Paper>
      </Container>

      <FaqSection items={faqs} />

      <Container maxWidth="lg" sx={{ pb: 8 }}>
        <Box sx={{ p: 4, borderRadius: 4, bgcolor: '#f2f8f4' }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={1.5}>
            <div>
              <Typography variant="h5" fontWeight={800}>ต้องการแพ็กเกจเฉพาะองค์กร?</Typography>
              <Typography color="text.secondary">คุยกับทีมฝ่ายขายเพื่อออกแบบโซลูชันที่เหมาะกับธุรกิจคุณ</Typography>
            </div>
            <Button component={Link} href="/contact" variant="contained">ติดต่อฝ่ายขาย</Button>
          </Stack>
        </Box>
      </Container>
      <PublicFooter />
    </main>
  );
}
