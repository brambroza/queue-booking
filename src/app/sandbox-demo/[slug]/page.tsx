import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Box, Button, Card, CardContent, Chip, Container, Grid, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import { LandingNavbar } from '@/components/public/landing-navbar';
import { LandingFooter } from '@/components/public/landing-footer';
import { FaqSection } from '@/components/public/faq-section';
import { BusinessSandbox } from '@/components/sandbox/business-sandbox';
import { SCENARIO_LIST, scenarioBySlug } from '@/lib/demo/scenarios';
import {
  formatBaht,
  jsonLdScript,
  relatedScenarios,
  sandboxPath,
  sandboxSteps,
  scenarioJsonLd,
  siteOrigin,
  SANDBOX_INDEX_PATH,
  SANDBOX_CONTENT_UPDATED,
} from '@/lib/demo/scenarios/seo';

export const dynamicParams = false;

/** One static page per business type. */
export function generateStaticParams() {
  return SCENARIO_LIST.map((s) => ({ slug: s.slug }));
}

type PageProps = { params: Promise<{ slug: string }> };

/** Title, description, canonical and social cards from the scenario's SEO copy. */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const scenario = scenarioBySlug(slug);
  if (!scenario) return {};
  const path = sandboxPath(scenario);
  return {
    title: scenario.seo.title,
    description: scenario.seo.description,
    keywords: scenario.seo.keywords,
    alternates: { canonical: path },
    openGraph: {
      type: 'website',
      locale: 'th_TH',
      url: path,
      title: scenario.seo.title,
      description: scenario.seo.description,
    },
    twitter: { card: 'summary_large_image', title: scenario.seo.title, description: scenario.seo.description },
  };
}

const cardSx = { height: '100%', borderRadius: 2, border: '1px solid', borderColor: 'divider', boxShadow: 'none' } as const;
const primaryBtnSx = { bgcolor: '#12a862', '&:hover': { bgcolor: '#0a7043' } } as const;

/**
 * Public sandbox for one business type. The text around the widget is server
 * rendered so crawlers and AI engines read it without running JavaScript;
 * the widget itself is a client island that never touches the database.
 */
export default async function SandboxScenarioPage({ params }: PageProps) {
  const { slug } = await params;
  const scenario = scenarioBySlug(slug);
  if (!scenario) notFound();

  const origin = siteOrigin();
  const { seo } = scenario;
  const steps = sandboxSteps(scenario);
  const related = relatedScenarios(SCENARIO_LIST, scenario);
  const resourcePrice = new Map(scenario.resources.filter((r) => r.unitPrice).map((r) => [r.code, r.unitPrice ?? 0]));

  return (
    <main>
      {scenarioJsonLd(scenario, origin, SANDBOX_CONTENT_UPDATED).map((block, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(block) }} />
      ))}
      <LandingNavbar />

      <Box component="header" sx={{ py: { xs: 5, md: 7 }, borderBottom: '1px solid', borderColor: 'divider', background: 'linear-gradient(180deg, #f3faf5 0%, #ffffff 100%)' }}>
        <Container maxWidth="lg">
          <Stack direction="row" spacing={1} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
            <Chip component={Link} href={SANDBOX_INDEX_PATH} clickable label="← ทุกประเภทธุรกิจ" size="small" />
            <Chip label="ทดลองฟรี · ไม่ต้องสมัคร · ไม่ต้องล็อกอิน" size="small" sx={{ bgcolor: '#EAF3DE', color: '#0a7043', fontWeight: 700 }} />
          </Stack>
          <Typography variant="h3" component="h1" sx={{ fontWeight: 800, fontSize: { xs: 28, md: 42 }, lineHeight: 1.25 }}>
            <span aria-hidden>{scenario.icon} </span>
            {seo.h1}
          </Typography>
          {/* AEO: answer-first paragraph an AI engine can quote on its own. */}
          <Typography component="p" sx={{ mt: 2, maxWidth: 820, fontSize: { xs: 16, md: 18 }, lineHeight: 1.8 }}>
            {seo.answer}
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2} sx={{ mt: 3 }}>
            <Button href="#sandbox" variant="contained" size="large" sx={primaryBtnSx}>
              เริ่มทดลองเลย
            </Button>
            <Button component={Link} href="/register" variant="outlined" size="large" sx={{ borderColor: '#12a862', color: '#12a862' }}>
              สมัครใช้ฟรี
            </Button>
          </Stack>
        </Container>
      </Box>

      <Container maxWidth="xl" sx={{ py: { xs: 3, md: 5 } }}>
        <Box id="sandbox" component="section" aria-label={`ทดลองระบบจองคิว${scenario.label}`} sx={{ scrollMarginTop: 88 }}>
          <BusinessSandbox scenario={scenario} />
        </Box>
      </Container>

      <Container maxWidth="lg" sx={{ py: 5 }}>
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Card sx={cardSx}>
              <CardContent>
                <Typography variant="h5" component="h2" fontWeight={800} gutterBottom>
                  ปัญหาคิวที่{scenario.label}เจอบ่อย
                </Typography>
                <Stack component="ul" spacing={1.2} sx={{ pl: 0, m: 0, listStyle: 'none' }}>
                  {seo.painPoints.map((p) => (
                    <Stack component="li" key={p} direction="row" spacing={1} alignItems="flex-start">
                      <ErrorOutlineRoundedIcon fontSize="small" sx={{ color: '#d97706', mt: 0.3 }} />
                      <Typography>{p}</Typography>
                    </Stack>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Card sx={cardSx}>
              <CardContent>
                <Typography variant="h5" component="h2" fontWeight={800} gutterBottom>
                  ระบบช่วยอะไรได้บ้าง
                </Typography>
                <Stack component="ul" spacing={1.2} sx={{ pl: 0, m: 0, listStyle: 'none' }}>
                  {seo.benefits.map((b) => (
                    <Stack component="li" key={b} direction="row" spacing={1} alignItems="flex-start">
                      <CheckCircleRoundedIcon fontSize="small" sx={{ color: '#12a862', mt: 0.3 }} />
                      <Typography>{b}</Typography>
                    </Stack>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Container>

      <Container maxWidth="lg" sx={{ pb: 5 }}>
        <Typography variant="h5" component="h2" fontWeight={800} gutterBottom>
          ตัวอย่างบริการของ{scenario.shopName}ในเดโมนี้
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          เปิดให้จอง {scenario.openTime}–{scenario.closeTime === '00:00' ? '24:00' : scenario.closeTime} น. ช่องละ {scenario.slotMinutes} นาที
          {scenario.resourcePicker !== 'none' && ` · ลูกค้าเลือก${scenario.resourceLabel}${scenario.resourcePicker === 'required' ? 'ก่อนจองทุกครั้ง' : 'ได้ หรือไม่ระบุก็ได้'}`}
        </Typography>
        <Box sx={{ overflowX: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
          <Table size="small" aria-label={`บริการตัวอย่างของ${scenario.label}`}>
            <TableHead>
              <TableRow>
                <TableCell>บริการ</TableCell>
                <TableCell>ระยะเวลา</TableCell>
                <TableCell>ราคา</TableCell>
                <TableCell>รูปแบบการจอง</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {scenario.services.map((svc) => {
                const perResource = scenario.resources.filter((r) => r.unitPrice && (!r.serviceKeys?.length || r.serviceKeys.includes(svc.key)));
                const prices = perResource.map((r) => resourcePrice.get(r.code) ?? 0);
                const priceText =
                  svc.price > 0
                    ? formatBaht(svc.price)
                    : prices.length
                      ? `${formatBaht(Math.min(...prices))}${Math.max(...prices) > Math.min(...prices) ? ` – ${formatBaht(Math.max(...prices))}` : ''} ต่อ${scenario.resourceLabel}`
                      : formatBaht(0);
                return (
                  <TableRow key={svc.key}>
                    <TableCell>
                      <Typography fontWeight={700}>{svc.icon} {svc.name}</Typography>
                      <Typography variant="body2" color="text.secondary">{svc.description}</Typography>
                    </TableCell>
                    <TableCell>{svc.durationMinutes} นาที</TableCell>
                    <TableCell>{priceText}</TableCell>
                    <TableCell>{BOOKING_MODE_LABELS[svc.bookingMode]}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Box>
      </Container>

      <Box component="section" sx={{ py: 6, bgcolor: '#FAFBF8', borderTop: '1px solid', borderBottom: '1px solid', borderColor: 'divider' }}>
        <Container maxWidth="lg">
          <Typography variant="h5" component="h2" fontWeight={800} gutterBottom>
            วิธีทดลองระบบจองคิว{scenario.label}ใน 3 นาที
          </Typography>
          <Box component="ol" sx={{ pl: 3, m: 0 }}>
            {steps.map((s) => (
              <Box component="li" key={s.name} sx={{ mb: 1.2 }}>
                <Typography fontWeight={700} component="span">{s.name}</Typography>
                <Typography color="text.secondary">{s.text}</Typography>
              </Box>
            ))}
          </Box>
        </Container>
      </Box>

      <FaqSection items={seo.faqs} />

      <Container maxWidth="lg" sx={{ pb: 7 }}>
        {(seo.solutionPath || seo.useCaseSlug) && (
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2} sx={{ mb: 4 }}>
            {seo.solutionPath && (
              <Button component={Link} href={seo.solutionPath} variant="text" sx={{ color: '#0a7043' }}>
                อ่านรายละเอียดระบบสำหรับ{scenario.label} →
              </Button>
            )}
            {seo.useCaseSlug && (
              <Button component={Link} href={`/use-cases/${seo.useCaseSlug}`} variant="text" sx={{ color: '#0a7043' }}>
                ดูตัวอย่างการตั้งค่า →
              </Button>
            )}
          </Stack>
        )}
        <Typography variant="h6" component="h2" fontWeight={800} gutterBottom>
          ทดลองกับธุรกิจประเภทอื่น
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {related.map((r) => (
            <Chip key={r.type} component={Link} href={sandboxPath(r)} clickable label={`${r.icon} ${r.label}`} variant="outlined" />
          ))}
          <Chip component={Link} href={SANDBOX_INDEX_PATH} clickable label="ดูทั้งหมด 21 ประเภท" color="success" variant="outlined" />
        </Stack>
      </Container>

      <LandingFooter />
    </main>
  );
}

const BOOKING_MODE_LABELS = {
  fixed_slot: 'นัดเวลาแน่นอน',
  flexible_duration: 'เวลายืดหยุ่น',
  capacity_based: 'รับเป็นรอบ',
  walk_in: 'Walk-in หน้าร้าน',
  request_approval: 'ร้านยืนยันก่อน',
} as const;
