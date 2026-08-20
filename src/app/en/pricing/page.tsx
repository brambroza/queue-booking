import type { Metadata } from 'next';
import { Container, Grid, Typography } from '@mui/material';
import { PublicNavbar } from '@/components/public/public-navbar';
import { PublicFooter } from '@/components/public/public-footer';
import { PricingCard } from '@/components/public/pricing-card';
import { pricingPlansEn } from '@/components/public/content';

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
        <Typography color="text.secondary" sx={{ mt: 1 }}>Start free with 50 bookings per month and scale as you grow.</Typography>
        <Grid container spacing={2} sx={{ mt: 1 }}>
          {pricingPlansEn.map((p) => (
            <Grid key={p.code} size={{ xs: 12, sm: 6, md: 3 }}>
              <PricingCard
                name={p.name}
                price={p.price}
                period={p.period}
                items={p.items}
                highlight={p.highlight}
                ctaHref={p.contactSales ? '/en/contact' : `/register?plan=${p.code}`}
                ctaLabel={p.contactSales ? 'Contact sales' : 'Start free'}
              />
            </Grid>
          ))}
        </Grid>
      </Container>
      <PublicFooter />
    </main>
  );
}
