import type { Metadata } from 'next';
import { PublicFooter } from '@/components/public/public-footer';
import { PublicNavbar } from '@/components/public/public-navbar';
import {
  CtaSection,
  FeatureSection,
  HeroSection,
  HowItWorksSection,
  MockCaseStudySection,
  PainPointSection,
  PricingPreviewSection,
  PromptPayShowcaseSection,
  ShowcaseSection,
  SolutionSection,
  TestimonialSection,
} from '@/components/public/sections';
import { faqs } from '@/components/public/content';

export const metadata: Metadata = {
  title: 'ระบบจองคิวผ่าน LINE OA สำหรับทุกธุรกิจ | LINE OA Queue Booking Platform',
  description:
    'ระบบจองคิวผ่าน LINE OA พร้อม Dashboard หลังบ้าน รองรับหลายร้าน หลายสาขา | LINE OA queue booking platform with LIFF and back-office dashboard.',
  alternates: {
    canonical: '/',
    languages: {
      'th-TH': '/',
      'en-US': '/en',
      'x-default': '/',
    },
  },
  openGraph: {
    title: 'ลูกค้าจองคิวผ่าน LINE ได้เอง ลดงานตอบแชทซ้ำ ๆ|ระบบจองคิวผ่าน LINE OA สำหรับทุกธุรกิจ | QueueBooking LINE',
    description: 'ให้ลูกค้าถามคิวว่างและจองคิวผ่าน LINE พร้อมระบบหลังบ้านครบวงจร | LINE OA queue booking with full dashboard.',
    url: '/',
    type: 'website',
    locale: 'th_TH',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ลูกค้าจองคิวผ่าน LINE ได้เอง ลดงานตอบแชทซ้ำ ๆ|ระบบจองคิวผ่าน LINE OA สำหรับทุกธุรกิจ',
    description: 'ให้ลูกค้าถามคิวว่างและจองคิวผ่าน LINE พร้อมระบบหลังบ้านครบวงจร',
  },
};

export default function HomePage() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://queuebooking.com';
  const softwareSchema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'QueueBooking LINE',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    inLanguage: ['th', 'en'],
    offers: [
      { '@type': 'Offer', priceCurrency: 'THB', price: '590', name: 'Starter' },
      { '@type': 'Offer', priceCurrency: 'THB', price: '1490', name: 'Professional' },
      { '@type': 'Offer', priceCurrency: 'THB', price: '3990', name: 'Business' },
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
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <PublicNavbar />
      <HeroSection />
      {/*    <StatsSection /> */}

      <PainPointSection />
      <SolutionSection />
      <PromptPayShowcaseSection />
      <ShowcaseSection />
      <FeatureSection />
      <HowItWorksSection />
      <PricingPreviewSection />
      <TestimonialSection />
      <MockCaseStudySection />
      <CtaSection />
      <PublicFooter />
    </main>
  );
}
