import type { BusinessType } from '@/lib/line/rich-menu/business-types';
import type { ResourceType } from '@/lib/booking/resource-types';
import type { BookingStatus, PaymentMethod, PaymentStatus } from '@/types/db';
import type { SignageTemplate, SignageTheme } from '@/lib/signage/types';

/**
 * One business scenario = everything the sandbox needs to look like a real shop
 * of that type: services, service points, a day of sample queues, chat lines,
 * promos and the SEO copy of its public page.
 *
 * The same record feeds two places, so they can never disagree:
 * - the public sandbox `/sandbox-demo/[slug]` (in memory, no DB)
 * - the portal demo sandbox (`src/lib/demo/sandbox.ts`, seeded into the shop's DB rows)
 *
 * Rules (checked by `scenarios.test.ts`):
 * - every `serviceKey` / `resourceCode` points at an entry of the same scenario
 * - queue numbers are unique inside a scenario
 * - prices are whole baht, durations are minutes > 0
 */

/** Same values as `services.booking_mode` in the database. */
export type ScenarioBookingMode = 'fixed_slot' | 'flexible_duration' | 'capacity_based' | 'walk_in' | 'request_approval';

export type ScenarioService = {
  /** Stable key inside the scenario (kebab-case), referenced by queues and resources. */
  key: string;
  /** Thai service name as the shop would write it, e.g. "ตัดผมชาย". */
  name: string;
  /** One short Thai line shown under the name in the LIFF picker. */
  description: string;
  /** Emoji icon in the LIFF picker. */
  icon: string;
  durationMinutes: number;
  /**
   * Whole baht charged online per booking when the shop takes payment — the real
   * product has no deposit and never multiplies by party size. 0 = no online
   * payment (pay at the shop). When the scenario prices resources, keep this 0.
   */
  price: number;
  bookingMode: ScenarioBookingMode;
  /** Queues per time slot for this service when no resource is picked. */
  capacityPerSlot: number;
};

export type ScenarioResource = {
  /** Short code, unique in the scenario, e.g. "C1", "ROOM-A". */
  code: string;
  /** Thai display name, e.g. "สนาม 1 (พื้นยาง)", "ช่างบอส". */
  name: string;
  type: ResourceType;
  /** Seats / people. Person resources (`trainer`) are always 1. */
  capacity: number;
  /** Price per slot in baht when the shop prices the resource, not the service (courts, rooms). */
  unitPrice?: number;
  /** Services this resource gives. Missing/empty = every service. */
  serviceKeys?: string[];
  /** One short Thai detail line shown in the picker, e.g. "แอร์ · 6 ที่นั่ง". */
  detail?: string;
};

export type ScenarioQueue = {
  /** e.g. "A001". Unique in the scenario. */
  queueNo: string;
  serviceKey: string;
  resourceCode?: string;
  /** "HH:MM" today, Bangkok time. */
  time: string;
  status: Extract<BookingStatus, 'pending_approval' | 'confirmed' | 'checked_in' | 'waiting' | 'called' | 'serving' | 'completed'>;
  /** Thai customer name as staff see it, e.g. "คุณมิ้นท์". */
  customerName: string;
  /** Name shown unmasked on the TV (pet name for `pet`, nickname elsewhere). Optional. */
  nickname?: string;
  /** 10-digit Thai mobile, fake (08x/09x-000-xxxx style is fine). */
  phone: string;
  partySize?: number;
  payment?: { method: PaymentMethod; status: PaymentStatus };
};

export type ScenarioChatLine = { role: 'customer' | 'bot'; text: string };

export type ScenarioPromo = { title: string; subtitle: string; cta: string };

export type ScenarioFaq = {
  /** A question a Thai shop owner would really type into Google / ChatGPT. */
  q: string;
  /** Direct answer first sentence, 2–4 sentences total, facts must match the product. */
  a: string;
};

export type ScenarioSeo = {
  /** <title>, ≤ 60 Thai chars, contains the main keyword, ends without the brand (layout adds it). */
  title: string;
  /** Meta description, 110–155 chars, says "ทดลองฟรี ไม่ต้องสมัคร". */
  description: string;
  /** Page H1. */
  h1: string;
  /** 4–8 Thai search phrases, most important first. */
  keywords: string[];
  /**
   * AEO answer block shown first on the page: 2–3 sentences that answer
   * "ระบบจองคิว<ประเภท>ผ่าน LINE คืออะไร / ทำอะไรได้" on their own,
   * so an AI engine can quote it as is.
   */
  answer: string;
  /** 3 short problems this business has with queues today. */
  painPoints: string[];
  /** 3–4 short outcomes, each tied to a real feature. */
  benefits: string[];
  /** 4–6 FAQ, unique to this business type (no copy-paste between types). */
  faqs: ScenarioFaq[];
  /** Matching `/use-cases/[slug]`, when one exists. */
  useCaseSlug?: string;
  /** Matching `/solutions/...` path, when one exists. */
  solutionPath?: string;
};

export type BusinessScenario = {
  type: BusinessType;
  /** URL slug for `/sandbox-demo/[slug]`, kebab-case English. */
  slug: string;
  /** Short Thai label for cards, e.g. "สนามแบดมินตัน". */
  label: string;
  /** Emoji for the picker card. */
  icon: string;
  /** Sample shop name shown in LINE / LIFF. Fictional, no real brand. */
  shopName: string;
  branchName: string;
  /** "HH:MM" */
  openTime: string;
  /** "HH:MM" (use "00:00" for midnight close). */
  closeTime: string;
  /** Minutes between slot starts in the LIFF time grid. */
  slotMinutes: number;
  /** Thai word for the service point in this business, e.g. "สนาม", "ช่าง", "โต๊ะ", "ห้อง". */
  resourceLabel: string;
  /**
   * How the LIFF asks for a resource:
   * - `required` — customer must pick (courts priced per resource)
   * - `optional` — can pick or leave "ไม่ระบุ"
   * - `none` — no resource step
   */
  resourcePicker: 'required' | 'optional' | 'none';
  /** Ask for party size (restaurant, buffet, event). */
  partySize?: { min: number; max: number; label: string };
  services: ScenarioService[];
  resources: ScenarioResource[];
  /** 5–7 queues covering waiting, called, serving, completed (and pending_approval when a service needs approval). */
  queues: ScenarioQueue[];
  /** 2–4 lines, customer asks, bot answers, Thai, natural. */
  chats: ScenarioChatLine[];
  /** 2 promos. */
  promos: ScenarioPromo[];
  signage: { template: SignageTemplate; theme: SignageTheme };
  seo: ScenarioSeo;
};
