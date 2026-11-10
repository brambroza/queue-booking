import type { PublicShowcaseCard } from '@/lib/showcase/showcase-rules';
import { LandingFooter } from './landing-footer';
import { LandingNavbar } from './landing-navbar';
import { ShopShowcaseSection } from './landing-shop-showcase';
import {
  BusinessSection,
  BusinessStrip,
  FaqSection,
  FeaturesSection,
  FinalCtaSection,
  HeroSection,
  LineExperienceSection,
  PricingSection,
  RichMenuSection,
  SignageSection,
  StepsSection,
  StickyCta,
  TrustSection,
} from './landing/landing-sections';
import { LandingMotion } from './landing/landing-motion';
import styles from './landing/landing.module.css';

const ROOT_ID = 'landing-root';

/**
 * Home page. A Server Component: every section renders as plain HTML, so the
 * page is complete before any script runs. Client islands are the navbar, the
 * tap-through LINE demo, the Flex / rich-menu canvases and the scroll reveal.
 *
 * Section order follows the buyer's questions: what is it → how does it work →
 * is it for my business → what does the customer see → features → price →
 * can I trust it → questions → start.
 *
 * @param showcase - Published shops (`loadPublicShowcase`); the section hides when empty.
 */
export function LandingPage({ showcase = [] }: { showcase?: PublicShowcaseCard[] }) {
  return (
    <div id={ROOT_ID} className={styles.root}>
      <LandingNavbar />
      <main>
        <HeroSection />
        <BusinessStrip />
        <StepsSection />
        <BusinessSection />
        <LineExperienceSection />
        <FeaturesSection />
        <RichMenuSection />
        <SignageSection />
        <PricingSection />
        <ShopShowcaseSection shops={showcase} />
        <TrustSection />
        <FaqSection />
        <FinalCtaSection />
      </main>
      <LandingFooter />
      <StickyCta />
      <LandingMotion rootId={ROOT_ID} />
    </div>
  );
}
