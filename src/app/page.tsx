import type { Metadata } from 'next';
import { PublicFooter } from '@/components/public/public-footer';
import { PublicNavbar } from '@/components/public/public-navbar';
import {
  CtaSection,
  FeatureSection,
  HeroSection,
  HowItWorksSection,
  PainPointSection,
  PricingPreviewSection,
 
  ShowcaseSection,
  SolutionSection,
  TestimonialSection,
} from '@/components/public/sections';

export const metadata: Metadata = {
  title: 'ระบบจองคิวผ่าน LINE OA สำหรับทุกธุรกิจ',
  description:
    'ระบบจองคิวผ่าน LINE OA พร้อม Dashboard หลังบ้าน รองรับหลายร้าน หลายสาขา และคิวทั้งแบบ Fix เวลาและไม่ Fix เวลา',
};

export default function HomePage() {
  return (
    <main>
      <PublicNavbar />
      <HeroSection />
  
      <PainPointSection />
      <SolutionSection />
      <ShowcaseSection />
      <FeatureSection />
      <HowItWorksSection />
      <PricingPreviewSection />
      <TestimonialSection />
      <CtaSection />
      <PublicFooter />
    </main>
  );
}
