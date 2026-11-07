import type { Metadata } from 'next';
import { LandingPage } from '@/components/public/landing-page';
import { faqs } from '@/components/public/content';
import { loadPublicShowcase } from '@/lib/showcase/showcase-server';

/** Showcase changes call revalidatePath('/'); this is the fallback refresh. */
export const revalidate = 300;


export const metadata: Metadata = {
  title: 'ระบบจองคิวผ่าน LINE OA ฟรี | จองคิวออนไลน์ นัดหมายลูกค้าอัตโนมัติ',
  description:
    'ระบบจองคิวออนไลน์และนัดหมายลูกค้าผ่าน LINE OA เริ่มใช้ฟรี ลูกค้าจองเองได้ 24 ชม. ผ่าน LIFF และแชทบอท แจ้งเตือนนัดอัตโนมัติ รับชำระ PromptPay พร้อมหลังบ้านหลายสาขา',
  alternates: {
    canonical: '/',
    languages: {
      'th-TH': '/',
      'en-US': '/en',
      'x-default': '/',
    },
  },
  openGraph: {
    title: 'ระบบจองคิวผ่าน LINE OA ฟรี | ลูกค้าจองคิวออนไลน์ได้เอง | QueueBooking',
    description: 'ให้ลูกค้าถามคิวว่างและจองคิวผ่าน LINE พร้อมระบบหลังบ้านครบวงจร | LINE OA queue booking with full dashboard.',
    url: '/',
    type: 'website',
    locale: 'th_TH',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ระบบจองคิวผ่าน LINE OA ฟรี | ลูกค้าจองคิวออนไลน์ได้เอง',
    description: 'ให้ลูกค้าถามคิวว่างและจองคิวผ่าน LINE พร้อมระบบหลังบ้านครบวงจร',
  },
};

export default async function HomePage() {
  const showcase = await loadPublicShowcase();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://queuebooking.com';
  const softwareSchema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'QueueBooking LINE',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    inLanguage: ['th', 'en'],
    // Prices must match the visible pricing table (pricingPlans in
    // components/public/content.ts). Structured data that contradicts the page
    // is a Search Console violation, not just an inconsistency.
    offers: [
      { '@type': 'Offer', priceCurrency: 'THB', price: '0', name: 'Starter' },
      { '@type': 'Offer', priceCurrency: 'THB', price: '990', name: 'Professional' },
      { '@type': 'Offer', priceCurrency: 'THB', price: '2490', name: 'Business' },
      { '@type': 'Offer', name: 'Custom', priceSpecification: { '@type': 'PriceSpecification', priceCurrency: 'THB' } },
    ],
    description: 'ระบบจองคิวผ่าน LINE OA พร้อม LIFF และ Dashboard สำหรับจัดการคิวหลายสาขา',
    url: appUrl,
  };

  const orgSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'QueueBooking LINE',
    url: appUrl,
    contactPoint: [
      {
        '@type': 'ContactPoint',
        contactType: 'sales',
        email: 'amnart.gl@gmail.com',
        telephone: '+66-85-608-3298',
      },
    ],
  };

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
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <LandingPage showcase={showcase} />
    </>
  );
}
