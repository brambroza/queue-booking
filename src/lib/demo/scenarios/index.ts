import { BUSINESS_TYPES, type BusinessType, normalizeBusinessType } from '@/lib/line/rich-menu/business-types';
import type { BusinessScenario } from './types';
import { salonScenario } from './salon';
import { nailScenario } from './nail';
import { clinicScenario } from './clinic';
import { restaurantScenario } from './restaurant';
import { buffetScenario } from './buffet';
import { fitnessScenario } from './fitness';
import { meetingRoomScenario } from './meeting-room';
import { autoRepairScenario } from './auto-repair';
import { mobileRepairScenario } from './mobile-repair';
import { fieldServiceScenario } from './field-service';
import { governmentScenario } from './government';
import { consultScenario } from './consult';
import { spaScenario } from './spa';
import { sportsCourtScenario } from './sports-court';
import { outdoorScenario } from './outdoor';
import { petScenario } from './pet';
import { beautyClinicScenario } from './beauty-clinic';
import { carCareScenario } from './car-care';
import { photoStudioScenario } from './photo-studio';
import { tutoringScenario } from './tutoring';
import { eventScenario } from './event';

export type * from './types';

/** Every business type → its sandbox scenario. `Record` makes a missing type a compile error. */
export const BUSINESS_SCENARIOS: Record<BusinessType, BusinessScenario> = {
  salon: salonScenario,
  nail: nailScenario,
  clinic: clinicScenario,
  restaurant: restaurantScenario,
  buffet: buffetScenario,
  fitness: fitnessScenario,
  meeting_room: meetingRoomScenario,
  auto_repair: autoRepairScenario,
  mobile_repair: mobileRepairScenario,
  field_service: fieldServiceScenario,
  government: governmentScenario,
  consult: consultScenario,
  spa: spaScenario,
  sports_court: sportsCourtScenario,
  outdoor: outdoorScenario,
  pet: petScenario,
  beauty_clinic: beautyClinicScenario,
  car_care: carCareScenario,
  photo_studio: photoStudioScenario,
  tutoring: tutoringScenario,
  event: eventScenario,
};

/** Scenarios in `BUSINESS_TYPES` order (the order the picker shows). */
export const SCENARIO_LIST: BusinessScenario[] = BUSINESS_TYPES.map((t) => BUSINESS_SCENARIOS[t]);

/** Fallback when a shop has no business type yet. */
export const DEFAULT_SCENARIO_TYPE: BusinessType = 'salon';

/**
 * Scenario for a URL slug, or null when the slug is unknown.
 * @param slug - Path segment of `/sandbox-demo/[slug]`.
 */
export function scenarioBySlug(slug: string): BusinessScenario | null {
  return SCENARIO_LIST.find((s) => s.slug === slug) ?? null;
}

/**
 * Scenario for any stored business label (normalized key, registration
 * category, legacy demo key like `barber`). Unknown = default scenario.
 * @param raw - `shops.business_type`, `shops.demo_business_type` or a request value.
 */
export function scenarioForBusiness(raw: string | null | undefined): BusinessScenario {
  const type = normalizeBusinessType(raw) ?? DEFAULT_SCENARIO_TYPE;
  return BUSINESS_SCENARIOS[type];
}
