import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Box, Button, Card, CardContent, Container, Stack, Typography } from '@mui/material';
import { PublicNavbar } from '@/components/public/public-navbar';
import { PublicFooter } from '@/components/public/public-footer';
import { useCases } from '@/components/public/content';
import { useCasesEnBySlug } from '@/components/public/use-cases-content-en';

type Params = { slug: string };

export function generateStaticParams() {
  return useCases.map((u) => ({ slug: u.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const found = useCases.find((u) => u.slug === slug);
  if (!found) return {};
  const en = useCasesEnBySlug[found.slug];
  return {
    title: `${en?.title ?? found.title} | LINE Queue Booking SaaS`,
    description: en?.summary ?? found.summary,
    alternates: {
      canonical: `/en/use-cases/${found.slug}`,
      languages: {
        'th-TH': `/use-cases/${found.slug}`,
        'en-US': `/en/use-cases/${found.slug}`,
        'x-default': `/use-cases/${found.slug}`,
      },
    },
  };
}

export default async function UseCaseDetailEnPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const item = useCases.find((u) => u.slug === slug);
  if (!item) notFound();
  const en = useCasesEnBySlug[item.slug];
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
            <Typography variant="h4" fontWeight={800}>{en?.title ?? item.title}</Typography>
            <Typography color="text.secondary">{en?.mode ?? item.mode}</Typography>
          </div>
        </Stack>

        <Card sx={{ borderRadius: 3 }}>
          <CardContent>
            <Typography variant="body1" color="text.secondary">{en?.summary ?? item.summary}</Typography>
            <Typography fontWeight={700} sx={{ mt: 2 }}>Suggested services</Typography>
            <Stack spacing={0.8} sx={{ mt: 1 }}>
              {(en?.services ?? item.services).map((s) => (
                <Typography key={s}>• {s}</Typography>
              ))}
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2} sx={{ mt: 3 }}>
              <Button component={Link} href="/register" variant="contained">Start free trial</Button>
              <Button component={Link} href="/en/contact" variant="outlined">Contact sales</Button>
              <Button component={Link} href="/en/use-cases" variant="text">Back to use cases</Button>
            </Stack>
          </CardContent>
        </Card>
      </Container>
      <PublicFooter />
    </main>
  );
}

