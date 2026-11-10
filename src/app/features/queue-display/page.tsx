import type { Metadata } from 'next';
import Link from 'next/link';
import { Box, Button, Container, Stack, Typography } from '@mui/material';
import { LandingNavbar } from '@/components/public/landing-navbar';
import { LandingFooter } from '@/components/public/landing-footer';
import { DigitalSignageShowcase } from '@/components/public/landing-signage-showcase';
import { FaqSection } from '@/components/public/faq-section';
import { SIGNAGE_TEMPLATES } from '@/lib/signage/types';

const TITLE = 'จอเรียกคิวหน้าร้านบนทีวีที่มีอยู่ ไม่ต้องซื้อตู้กดบัตร';
const DESCRIPTION =
  'จอแสดงคิวหน้าร้านเปิดจากเบราว์เซอร์บนสมาร์ททีวี แท็บเล็ต หรือป้ายตั้งพื้น เลขคิวที่กำลังเรียกขึ้นตัวใหญ่ อัปเดตเองเมื่อพนักงานกดเรียกคิวใน LINE มี 11 เทมเพลต เปลี่ยนสีตามร้านได้';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: ['จอเรียกคิว', 'จอแสดงคิว', 'ระบบเรียกคิว', 'digital signage คิว', 'จอคิวทีวี'],
  alternates: { canonical: '/features/queue-display' },
  openGraph: { type: 'website', locale: 'th_TH', url: '/features/queue-display', title: TITLE, description: DESCRIPTION },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
};

const FAQS = [
  {
    q: 'จอเรียกคิวต้องซื้ออุปกรณ์เพิ่มไหม',
    a: 'ไม่ต้อง ใช้สมาร์ททีวี แท็บเล็ต หรือจอใดก็ได้ที่เปิดเบราว์เซอร์ได้ เปิดลิงก์จอคิวของร้านแล้วปล่อยไว้ ต้องการจอพร้อมติดตั้งทักทีมงานขอใบเสนอราคาแยกได้',
  },
  {
    q: 'จอคิวอัปเดตอย่างไร',
    a: 'เมื่อพนักงานกดเรียกคิวในระบบหลังบ้าน จอดึงข้อมูลใหม่เองทุกไม่กี่วินาที เลขคิวที่เรียกขึ้นตัวใหญ่พร้อมคิวถัดไป ลูกค้าที่จองผ่าน LINE ได้ข้อความถึงคิวพร้อมกัน',
  },
  {
    q: 'เปลี่ยนรูปแบบหรือสีจอได้ไหม',
    a: `ได้ มี ${SIGNAGE_TEMPLATES.length} เทมเพลต ทั้งแนวนอนและแนวตั้ง เลือกธีมสี ใส่โลโก้ ข้อความประกาศ และ QR ให้ลูกค้าจองคิวจากหน้าจอได้ในเมนู จอแสดงคิว`,
  },
  {
    q: 'ร้านที่ยังจดคิวใน Google Sheet ใช้จอได้ไหม',
    a: 'ได้ มีส่วนเสริมอ่านคิวจาก Google Sheet ของร้านขึ้นจอโดยตรง โดยไม่ต้องย้ายระบบ เหมาะกับโรงพยาบาลสัตว์หรือคลินิกที่พนักงานกรอกชีตอยู่แล้ว',
  },
];

/**
 * Feature page for the queue display. Holds the full device showcase (TV,
 * floor-standing kiosk, tablet poster) that used to sit on the home page.
 */
export default function QueueDisplayFeaturePage() {
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQS.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  };

  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <LandingNavbar />
      <Container maxWidth="lg" sx={{ pt: { xs: 6, md: 9 }, pb: 2 }}>
        <Stack spacing={2} sx={{ maxWidth: 760 }}>
          <Typography variant="overline" sx={{ color: '#087f45', fontWeight: 600, letterSpacing: '.08em' }}>
            จอเรียกคิว / Digital Signage
          </Typography>
          <Typography variant="h3" component="h1" fontWeight={700} sx={{ letterSpacing: '-.02em', lineHeight: 1.15 }}>
            {TITLE}
          </Typography>
          <Typography color="text.secondary" sx={{ fontSize: 17 }}>
            {DESCRIPTION}
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ pt: 1 }}>
            <Button component={Link} href="/register" variant="contained" size="large" sx={{ borderRadius: 3 }}>
              เริ่มใช้ฟรี
            </Button>
            <Button component={Link} href="/blog/queue-display-on-any-tv-without-kiosk" variant="outlined" size="large" sx={{ borderRadius: 3 }}>
              อ่านวิธีตั้งค่าใน 5 นาที
            </Button>
          </Stack>
        </Stack>
      </Container>
      <Box sx={{ mt: { xs: 2, md: 4 } }}>
        <DigitalSignageShowcase />
      </Box>
      <FaqSection items={FAQS} />
      <LandingFooter />
    </main>
  );
}
