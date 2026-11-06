import { DEFAULT_SCENARIO_TYPE, scenarioForBusiness, type BusinessScenario, type ScenarioService } from '@/lib/demo/scenarios';
import type { BusinessType } from '@/lib/line/rich-menu/business-types';
import type { BookingStatus, PaymentMethod, PaymentStatus } from '@/types/db';
import type { ResourceType } from '@/lib/booking/resource-types';
import type { SignageTemplate, SignageTheme } from '@/lib/signage/types';

/**
 * Pure planning step of the portal demo sandbox: turns a `BusinessScenario`
 * into the exact rows `createDemoSandbox` inserts, with no database access.
 * Keeping it pure lets vitest check prices, payment states and links.
 */

/** Options that change what gets seeded. */
export type DemoSeedOptions = {
  /** true = seed the scenario's payment states; false = no payment columns at all. */
  withPayment: boolean;
};

export type PlannedService = {
  service_name: string;
  booking_mode: ScenarioService['bookingMode'];
  duration_minutes: number;
  min_duration_minutes: number | null;
  max_duration_minutes: number | null;
  capacity_per_slot: number;
  requires_approval: boolean;
  allow_walk_in: boolean;
  price: number;
};

export type PlannedResource = {
  resource_code: string;
  resource_name: string;
  resource_type: ResourceType;
  capacity: number;
  unit_price: number;
  /** Names of the services this resource gives (empty = every service). */
  service_names: string[];
};

export type PlannedBooking = {
  queue_number: string;
  service_name: string;
  resource_code: string | null;
  /** "HH:MM" */
  start_time: string;
  status: BookingStatus;
  customer_name: string;
  customer_phone: string;
  nickname: string | null;
  party_size: number | null;
  /** true = booking day is yesterday (completed queues), false = today. */
  previous_day: boolean;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod | null;
  /** Whole baht; null when nothing is owed / payment is off. */
  payment_amount: number | null;
};

export type DemoSeedPlan = {
  businessType: BusinessType;
  branchName: string;
  /** "HH:MM:00" */
  openTime: string;
  /** "HH:MM:00" ("00:00:00" = midnight close) */
  closeTime: string;
  slotMinutes: number;
  services: PlannedService[];
  resources: PlannedResource[];
  bookings: PlannedBooking[];
  chats: Array<{ direction: 'customer' | 'bot'; message_text: string }>;
  signage: { template: SignageTemplate; theme: SignageTheme };
};

/** "HH:MM" → "HH:MM:00". */
function withSeconds(hhmm: string): string {
  return `${hhmm}:00`;
}

/** How many slots a flexible-duration demo service may stretch to. */
const FLEXIBLE_MAX_SLOTS = 4;

/**
 * Amount a seeded booking owes: the service price, or the resource's
 * `unit_price` when the service price is 0. No deposits, never multiplied by
 * party size. 0 means nothing to pay.
 *
 * @param servicePrice - Service price in baht.
 * @param unitPrice - Resource price per slot in baht (0 = not priced).
 */
export function resolveDemoAmount(servicePrice: number, unitPrice: number): number {
  return servicePrice > 0 ? servicePrice : Math.max(unitPrice, 0);
}

/**
 * Build the rows the portal demo sandbox seeds for a business type.
 *
 * @param scenario - Shared scenario data (`scenarioForBusiness(...)`).
 * @param options - `withPayment` false strips every payment column.
 * @returns Plain row descriptions; the caller maps names to DB ids.
 */
export function buildDemoSeedPlan(scenario: BusinessScenario, options: DemoSeedOptions): DemoSeedPlan {
  const serviceByKey = new Map(scenario.services.map((s) => [s.key, s]));
  const resourceByCode = new Map(scenario.resources.map((r) => [r.code, r]));

  const services: PlannedService[] = scenario.services.map((s) => ({
    service_name: s.name,
    booking_mode: s.bookingMode,
    duration_minutes: s.durationMinutes,
    min_duration_minutes: s.bookingMode === 'flexible_duration' ? s.durationMinutes : null,
    max_duration_minutes: s.bookingMode === 'flexible_duration' ? s.durationMinutes * FLEXIBLE_MAX_SLOTS : null,
    capacity_per_slot: s.capacityPerSlot,
    requires_approval: s.bookingMode === 'request_approval',
    allow_walk_in: s.bookingMode === 'walk_in',
    price: s.price,
  }));

  const resources: PlannedResource[] = scenario.resources.map((r) => ({
    resource_code: r.code,
    resource_name: r.name,
    resource_type: r.type,
    capacity: r.capacity,
    unit_price: r.unitPrice ?? 0,
    service_names: (r.serviceKeys ?? []).map((k) => serviceByKey.get(k)?.name).filter((n): n is string => Boolean(n)),
  }));

  const bookings: PlannedBooking[] = [];
  for (const q of scenario.queues) {
    const service = serviceByKey.get(q.serviceKey);
    if (!service) continue;
    const resource = q.resourceCode ? resourceByCode.get(q.resourceCode) : undefined;
    const amount = resolveDemoAmount(service.price, resource?.unitPrice ?? 0);
    const payment = options.withPayment && amount > 0 ? q.payment : undefined;
    bookings.push({
      queue_number: q.queueNo,
      service_name: service.name,
      resource_code: resource?.code ?? null,
      start_time: q.time,
      status: q.status,
      customer_name: q.customerName,
      customer_phone: q.phone,
      nickname: q.nickname ?? null,
      party_size: q.partySize ?? null,
      previous_day: q.status === 'completed',
      payment_status: payment?.status ?? 'unpaid',
      payment_method: payment ? payment.method : null,
      payment_amount: payment ? amount : null,
    });
  }

  return {
    businessType: scenario.type,
    branchName: scenario.branchName,
    openTime: withSeconds(scenario.openTime),
    closeTime: withSeconds(scenario.closeTime),
    slotMinutes: scenario.slotMinutes,
    services,
    resources,
    bookings,
    chats: scenario.chats.map((c) => ({ direction: c.role, message_text: c.text })),
    signage: scenario.signage,
  };
}

/**
 * Resolve any stored/requested label (legacy `barber`, `general_service`,
 * registration category, null) to the scenario's normalized business type.
 *
 * @param raw - Raw value from a request or `shops.demo_business_type`.
 */
export function resolveDemoBusinessType(raw: string | null | undefined): BusinessType {
  return scenarioForBusiness(raw ?? DEFAULT_SCENARIO_TYPE).type;
}
