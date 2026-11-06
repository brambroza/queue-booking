import type { Metadata } from 'next';
import Link from 'next/link';
import { Box, Card, CardActionArea, CardContent, Chip, Container, Grid, Stack, Typography } from '@mui/material';
import { LandingNavbar } from '@/components/public/landing-navbar';
import { LandingFooter } from '@/components/public/landing-footer';
import { FaqSection } from '@/components/public/faq-section';
import { SCENARIO_LIST } from '@/lib/demo/scenarios';
import { jsonLdScript, sandboxIndexJsonLd, sandboxPath, siteOrigin, SANDBOX_INDEX_PATH } from '@/lib/demo/scenarios/seo';

const TITLE = 'ทดลองระบบจองคิวผ่าน LINE ฟรี เลือกตามประเภทธุรกิจ';
const DESCRIPTION =
  'ทดลองระบบจองคิวผ่าน LINE ฟรี ไม่ต้องสมัคร เลือกประเภทธุรกิจ 21 แบบ ตั้งว่ามีชำระเงินหรือไม่ แล้วลองจองแบบลูกค้า เรียกคิวแบบพนักงาน และดูจอทีวีหน้าร้านได้ทันที';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: ['ทดลองระบบจองคิว', 'ระบบจองคิวผ่าน LINE', 'เดโมระบบจองคิว', 'ระบบจองคิวออนไลน์ฟรี', 'LINE OA จองคิว'],
  alternates: { canonical: SANDBOX_INDEX_PATH },
  openGraph: { type: 'website', locale: 'th_TH', url: SANDBOX_INDEX_PATH, title: TITLE, description: DESCRIPTION },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
};

const FAQS = [
  {
    q: 'ทดลองระบบจองคิวผ่าน LINE ต้องสมัครหรือเชื่อม LINE OA ก่อนไหม',
    a: 'ไม่ต้อง หน้าทดลองนี้จำลองทุกหน้าจอไว้ในเบราว์เซอร์ ไม่ต้องสมัคร ไม่ต้องล็อกอิน และไม่ส่งข้อความจริงไปที่ LINE ของใคร',
  },
  {
    q: 'หน้าจอในเดโมเหมือนของจริงแค่ไหน',
    a: 'Rich Menu การ์ดยืนยันคิว ปุ่มในหน้าจอง และจอทีวีแสดงคิว ใช้ชิ้นส่วนเดียวกับระบบจริง ต่างกันแค่ข้อมูลเป็นตัวอย่างและไม่บันทึกลงฐานข้อมูล',
  },
  {
    q: 'ถ้าธุรกิจของฉันไม่อยู่ใน 21 ประเภทนี้ ใช้ระบบได้ไหม',
    a: 'ได้ เลือกประเภทที่ใกล้ที่สุดเพื่อดูภาพรวม แล้วตั้งชื่อบริการ เวลา และราคาของร้านเองได้ทั้งหมดหลังสมัคร',
  },
  {
    q: 'ทดลองแล้วอยากใช้จริงต้องทำอะไรต่อ',
    a: 'สมัครฟรีที่หน้าสมัคร ระบบสร้างสาขา บริการ และเวลาทำการเริ่มต้นตามประเภทธุรกิจให้ทันที จากนั้นเชื่อม LINE OA ของร้านซึ่งใช้เวลาประมาณ 15–30 นาที',
  },
];

/**
 * Sandbox picker: one card per business type, each linking to its own
 * statically generated sandbox page.
 */
export default function SandboxDemoIndexPage() {
  const origin = siteOrigin();
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQS.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  };

  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(sandboxIndexJsonLd(SCENARIO_LIST, origin)) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(faqSchema) }} />
      <LandingNavbar />

      <Box component="header" sx={{ py: { xs: 5, md: 8 }, borderBottom: '1px solid', borderColor: 'divider', background: 'linear-gradient(180deg, #f3faf5 0%, #ffffff 100%)' }}>
        <Container maxWidth="lg">
          <Chip label="ทดลองฟรี · ไม่ต้องสมัคร" size="small" sx={{ bgcolor: '#EAF3DE', color: '#0a7043', fontWeight: 700 }} />
          <Typography variant="h3" component="h1" sx={{ mt: 2, fontWeight: 800, fontSize: { xs: 28, md: 44 }, lineHeight: 1.25 }}>
            ทดลองระบบจองคิวผ่าน LINE ตามประเภทธุรกิจของคุณ
          </Typography>
          <Typography component="p" sx={{ mt: 2, maxWidth: 820, fontSize: { xs: 16, md: 18 }, lineHeight: 1.8 }}>
            เลือกประเภทธุรกิจ แล้วเลือกว่าร้านเก็บเงินออนไลน์ตอนจองหรือจ่ายที่หน้าร้าน จากนั้นลองจองคิวแบบลูกค้าใน LINE
            เรียกคิวแบบพนักงานหลังร้าน และดูจอทีวีหน้าร้านเปลี่ยนตามได้ทันที ทุกอย่างจำลองในเบราว์เซอร์ ไม่ต้องสมัครและไม่บันทึกข้อมูล
          </Typography>
          <Stack component="ol" direction={{ xs: 'column', md: 'row' }} spacing={{ xs: 0.5, md: 3 }} sx={{ mt: 3, pl: 2.5, color: 'text.secondary' }}>
            <li>เลือกประเภทธุรกิจ</li>
            <li>เลือกว่ามีชำระเงินไหม</li>
            <li>เล่นได้เลย</li>
          </Stack>
        </Container>
      </Box>

      <Container maxWidth="lg" component="section" aria-labelledby="pick-type" sx={{ py: { xs: 4, md: 6 } }}>
        <Typography id="pick-type" variant="h5" component="h2" fontWeight={800} sx={{ mb: 2.5 }}>
          เลือกประเภทธุรกิจ ({SCENARIO_LIST.length} แบบ)
        </Typography>
        <Grid container spacing={2}>
          {SCENARIO_LIST.map((s) => (
            <Grid key={s.type} size={{ xs: 6, sm: 4, md: 3 }}>
              <Card sx={{ height: '100%', borderRadius: 2, border: '1px solid', borderColor: 'divider', boxShadow: 'none', '&:hover': { borderColor: '#12a862' } }}>
                <CardActionArea component={Link} href={sandboxPath(s)} sx={{ height: '100%', alignItems: 'flex-start' }}>
                  <CardContent>
                    <Typography sx={{ fontSize: 34, lineHeight: 1 }} aria-hidden>
                      {s.icon}
                    </Typography>
                    <Typography component="h3" fontWeight={800} sx={{ mt: 1 }}>
                      {s.label}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      {s.services.slice(0, 2).map((svc) => svc.name).join(' · ')}
                    </Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>

      <FaqSection items={FAQS} />
      <LandingFooter />
    </main>
  );
}
