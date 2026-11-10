import type { Metadata } from 'next';
import { LandingPage } from '@/components/public/landing-page';
import { pricingPlans } from '@/components/public/content';
import { landingDefinition, landingFaqs } from '@/components/public/landing/landing-content';
import { loadPublicShowcase } from '@/lib/showcase/showcase-server';

/** Showcase changes call revalidatePath('/'); this is the fallback refresh. */
export const revalidate = 300;

const TITLE = 'ระบบจองคิวออนไลน์ผ่าน LINE OA ฟรี | QueueBooking';
const DESCRIPTION =
  'ระบบจองคิวออนไลน์และนัดหมายลูกค้าผ่าน LINE OA เริ่มใช้ฟรี 50 คิว/เดือน ลูกค้าจองเองจาก Rich Menu ได้ 24 ชม. เตือนนัดอัตโนมัติ รับชำระ PromptPay ในแชท จอเรียกคิวบนทีวี หลังบ้านหลายสาขา';

export const metadata: Metadata = {
  // The root layout's template appends "| QueueBooking"; this title already carries the brand, so opt out.
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: {
    canonical: '/',
    languages: {
      'th-TH': '/',
      'en-US': '/en',
      'x-default': '/',
    },
  },
  openGraph: {
    title: TITLE,
    description: 'ให้ลูกค้าจองคิวเองใน LINE ร้านจัดคิวทุกสาขาจากหลังบ้านเดียว เริ่มใช้ฟรี',
    url: '/',
    type: 'website',
    locale: 'th_TH',
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: 'ให้ลูกค้าจองคิวเองใน LINE ร้านจัดคิวทุกสาขาจากหลังบ้านเดียว เริ่มใช้ฟรี',
  },
};

/** Feature names for SoftwareApplication.featureList; plain words search engines can match. */
const FEATURE_LIST = [
  'จองคิวผ่าน LINE OA และ LIFF โดยลูกค้าไม่ต้องโหลดแอป',
  'แสดงเฉพาะช่วงเวลาที่ว่าง กันจองซ้อน',
  'เตือนนัดอัตโนมัติทาง LINE ก่อนถึงคิว 15 นาที ถึง 1 วัน',
  'รับชำระเงินล่วงหน้าผ่าน PromptPay QR แอปธนาคาร หรือสลิปโอนเงิน',
  'กระดานคิวหลายสาขา เรียกคิวแล้วส่งข้อความถึงลูกค้า',
  'จอเรียกคิวบนสมาร์ททีวี 11 เทมเพลต',
  'ตัวสร้าง Rich Menu ตามประเภทธุรกิจ เผยแพร่ไป LINE ได้จากระบบ',
  'ซิงก์ Google Calendar และรายงานยอดคิว ส่งออก PDF / CSV',
];

export default async function HomePage() {
  const showcase = await loadPublicShowcase();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://queuebooking.com';

  const softwareSchema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'QueueBooking',
    alternateName: 'QueueBooking LINE',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    inLanguage: ['th', 'en'],
    url: appUrl,
    description: landingDefinition,
    featureList: FEATURE_LIST,
    screenshot: [`${appUrl}/images/product/liff-slots.webp`, `${appUrl}/images/product/portal-queue-board.webp`],
    softwareHelp: { '@type': 'CreativeWork', url: `${appUrl}/blog/connect-line-oa-to-queue-booking-system-step-by-step` },
    // Prices must match the visible pricing table (pricingPlans in
    // components/public/content.ts). Structured data that contradicts the page
    // is a Search Console violation, not just an inconsistency.
    offers: pricingPlans.map((plan) =>
      plan.contactSales
        ? { '@type': 'Offer', name: plan.name, priceSpecification: { '@type': 'PriceSpecification', priceCurrency: 'THB' } }
        : { '@type': 'Offer', name: plan.name, priceCurrency: 'THB', price: plan.price.replace(/[^\d]/g, '') || '0' },
    ),
    publisher: { '@type': 'Organization', name: 'QueueBooking', url: appUrl },
  };

  const webPageSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: TITLE,
    url: appUrl,
    inLanguage: 'th-TH',
    description: DESCRIPTION,
    speakable: { '@type': 'SpeakableSpecification', cssSelector: ['#definition', 'h1'] },
    about: { '@type': 'Thing', name: 'ระบบจองคิวออนไลน์ผ่าน LINE OA' },
  };

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: landingFaqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <LandingPage showcase={showcase} />
    </>
  );
}
