import type { BusinessScenario } from './types';

/**
 * SEO / GEO / AEO helpers for the public sandbox pages.
 *
 * Everything here is pure so the JSON-LD and the visible page text come from
 * the same scenario record: search engines penalise structured data that does
 * not match what the page shows, and AI answer engines quote the visible
 * `answer` block, so the two must never drift.
 */

/** Bump when scenario copy changes; feeds `dateModified` in JSON-LD and the sitemap. */
export const SANDBOX_CONTENT_UPDATED = '2026-11-06';

/** Public path of the sandbox picker. */
export const SANDBOX_INDEX_PATH = '/sandbox-demo';

/**
 * Public path of one scenario's sandbox page.
 * @param scenario - Scenario to link to.
 */
export function sandboxPath(scenario: Pick<BusinessScenario, 'slug'>): string {
  return `${SANDBOX_INDEX_PATH}/${scenario.slug}`;
}

/**
 * Site origin without a trailing slash, from `NEXT_PUBLIC_APP_URL`.
 * @param raw - Override for tests; defaults to the env value.
 */
export function siteOrigin(raw: string | undefined = process.env.NEXT_PUBLIC_APP_URL): string {
  return (raw || 'https://queuebooking.com').replace(/\/+$/, '');
}

/**
 * Format whole baht the way Thai shops print prices ("1,200 บาท", "ฟรี").
 * @param baht - Whole baht amount.
 */
export function formatBaht(baht: number): string {
  return baht > 0 ? `${baht.toLocaleString('th-TH')} บาท` : 'ฟรี / ชำระหน้าร้าน';
}

/**
 * The visible "how the sandbox works" steps, shared by the page and the HowTo schema.
 * @param scenario - Scenario whose wording (resource label, payment) is used.
 */
export function sandboxSteps(scenario: BusinessScenario): Array<{ name: string; text: string }> {
  const pick =
    scenario.resourcePicker === 'none'
      ? 'เลือกบริการ วัน และเวลาที่ยังว่าง'
      : `เลือกบริการ ${scenario.resourceLabel} วัน และเวลาที่ยังว่าง`;
  return [
    { name: 'เลือกว่ามีชำระเงินออนไลน์หรือไม่', text: 'เลือกแบบเก็บเงินตอนจองผ่าน PromptPay / แอปธนาคาร / โอนแนบสลิป หรือแบบจ่ายที่หน้าร้าน' },
    { name: 'จองแบบลูกค้าใน LINE', text: `กดเมนูจองคิวใน Rich Menu ของ${scenario.shopName} แล้ว${pick}` },
    { name: 'รับข้อความยืนยันใน LINE', text: 'ลูกค้าได้การ์ดยืนยันพร้อมเลขคิว และปุ่มยกเลิกคิวเองได้' },
    { name: 'จัดการคิวหลังร้าน', text: 'กดเรียกคิว เริ่มบริการ และปิดคิว ลูกค้าได้ข้อความ "ถึงคิวของคุณแล้ว" ทาง LINE' },
    { name: 'ดูจอทีวีแสดงคิว', text: 'จอหน้าร้านอัปเดตคิวที่กำลังเรียกและคิวถัดไปตามการกดของพนักงาน' },
  ];
}

type JsonLd = Record<string, unknown>;

/**
 * JSON-LD blocks for one scenario page: WebPage, SoftwareApplication, FAQPage, HowTo.
 * BreadcrumbList is rendered globally by the root layout, so it is not repeated here.
 * @param scenario - Scenario of the page.
 * @param origin - Site origin, see `siteOrigin`.
 * @param dateModified - ISO date (YYYY-MM-DD) the content last changed.
 */
export function scenarioJsonLd(scenario: BusinessScenario, origin: string, dateModified: string): JsonLd[] {
  const url = `${origin}${sandboxPath(scenario)}`;
  const { seo } = scenario;
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      '@id': `${url}#webpage`,
      url,
      name: seo.title,
      description: seo.description,
      inLanguage: 'th-TH',
      dateModified,
      isPartOf: { '@type': 'WebSite', name: 'QueueBooking LINE', url: origin },
      about: { '@type': 'Thing', name: scenario.label },
      keywords: seo.keywords.join(', '),
      mainEntity: { '@id': `${url}#faq` },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: `QueueBooking LINE สำหรับ${scenario.label}`,
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web, LINE',
      inLanguage: 'th',
      url,
      description: seo.answer,
      featureList: seo.benefits,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'THB', description: 'แพ็กเกจ Starter ใช้ฟรี' },
      publisher: { '@type': 'Organization', name: 'GoAlong Co., Ltd.', url: origin },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      '@id': `${url}#faq`,
      mainEntity: seo.faqs.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'HowTo',
      name: `วิธีทดลองระบบจองคิว${scenario.label}ผ่าน LINE`,
      inLanguage: 'th-TH',
      totalTime: 'PT3M',
      step: sandboxSteps(scenario).map((s, i) => ({ '@type': 'HowToStep', position: i + 1, name: s.name, text: s.text, url: `${url}#sandbox` })),
    },
  ];
}

/**
 * JSON-LD for the picker page: an ItemList of every scenario page.
 * @param scenarios - Scenarios in display order.
 * @param origin - Site origin, see `siteOrigin`.
 */
export function sandboxIndexJsonLd(scenarios: BusinessScenario[], origin: string): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'ทดลองระบบจองคิวผ่าน LINE ตามประเภทธุรกิจ',
    numberOfItems: scenarios.length,
    itemListElement: scenarios.map((s, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: s.seo.h1,
      url: `${origin}${sandboxPath(s)}`,
    })),
  };
}

/**
 * Serialize JSON-LD for a `<script type="application/ld+json">`, escaping `<`
 * so scenario text can never close the script tag.
 * @param data - JSON-LD object.
 */
export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

/**
 * Up to `count` other scenarios to link from a page (internal linking for crawlers):
 * the next ones in list order, wrapping around, so every page gets inbound links.
 * @param scenarios - All scenarios in display order.
 * @param current - The page's scenario.
 * @param count - How many to return.
 */
export function relatedScenarios(scenarios: BusinessScenario[], current: BusinessScenario, count = 6): BusinessScenario[] {
  const index = scenarios.findIndex((s) => s.type === current.type);
  const out: BusinessScenario[] = [];
  for (let step = 1; step < scenarios.length && out.length < count; step += 1) {
    out.push(scenarios[(index + step) % scenarios.length]);
  }
  return out;
}
