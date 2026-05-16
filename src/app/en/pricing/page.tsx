import type { Metadata } from 'next';
import { Container, Grid, Typography } from '@mui/material';
import { PublicNavbar } from '@/components/public/public-navbar';
import { PublicFooter } from '@/components/public/public-footer';
import { PricingCard } from '@/components/public/pricing-card';

export const metadata: Metadata = {
  title: 'Pricing | ระบบจองคิวผ่าน LINE OA | QueueBooking LINE',
  description: 'Choose the best plan for your LINE OA queue booking workflow.',
  alternates: {
    canonical: '/en/pricing',
    languages: {
      'th-TH': '/pricing',
      'en-US': '/en/pricing',
      'x-default': '/pricing',
    },
  },
};

export default function PricingEnPage() {
  return (
    <main>
      <PublicNavbar />
      <Container maxWidth="xl" sx={{ py: 8 }}>
        <Typography variant="h3" fontWeight={800}>Pricing Plans</Typography>
        <Typography color="text.secondary" sx={{ mt: 1 }}>Start with a 14-day free trial and scale as you grow.</Typography>
        <Grid container spacing={2} sx={{ mt: 1 }}>
          <Grid size={{ xs: 12, md: 4 }}><PricingCard name="Starter" price="590 THB" items={['1 shop', '1 branch', '3 services', '300 bookings/month']} /></Grid>
          <Grid size={{ xs: 12, md: 4 }}><PricingCard name="Professional" price="1,490 THB" items={['1 shop', '5 branches', 'Unlimited services', '2,000 bookings/month']} highlight /></Grid>
          <Grid size={{ xs: 12, md: 4 }}><PricingCard name="Business" price="3,990 THB" items={['Multi-shop', 'Unlimited services', '10,000 bookings/month', 'Advanced reports']} /></Grid>
        </Grid>
      </Container>
      <PublicFooter />
    </main>
  );
}

