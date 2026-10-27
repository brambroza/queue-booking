/**
 * Business types used to pick a rich menu master template.
 *
 * Normalized keys live on `shops.business_type`. Registration collects a
 * free-text `business_category` (Thai/English mix, see register-form) and the
 * demo sandbox stores `demo_business_type`; both are mapped here so every
 * caller works with one enum.
 */

export const BUSINESS_TYPES = [
  'salon',
  'nail',
  'clinic',
  'restaurant',
  'buffet',
  'fitness',
  'meeting_room',
  'auto_repair',
  'mobile_repair',
  'field_service',
  'government',
  'consult',
  'spa',
  'sports_court',
  'outdoor',
  'pet',
  'beauty_clinic',
  'car_care',
  'photo_studio',
  'tutoring',
  'event',
] as const;

export type BusinessType = (typeof BUSINESS_TYPES)[number];

/** Thai display label per business type. */
export const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = {
  salon: 'ร้านตัดผม / เสริมสวย',
  nail: 'ร้านทำเล็บ',
  clinic: 'คลินิก / สถานพยาบาล',
  restaurant: 'ร้านอาหาร',
  buffet: 'บุฟเฟ่ต์',
  fitness: 'ฟิตเนส / คลาสออกกำลังกาย',
  meeting_room: 'ห้องประชุม / พื้นที่เช่า',
  auto_repair: 'ศูนย์บริการรถยนต์',
  mobile_repair: 'ร้านซ่อมมือถือ / ไอที',
  field_service: 'ทีมช่าง / ติดตั้งนอกสถานที่',
  government: 'หน่วยงานราชการ',
  consult: 'ที่ปรึกษา / นัดหมายส่วนตัว',
  spa: 'สปา / ร้านนวด',
  sports_court: 'สนามกีฬา (แบด / เทนนิส / ฟุตบอล)',
  outdoor: 'สนามบีบีกัน / กิจกรรม outdoor',
  pet: 'สัตว์เลี้ยง (อาบน้ำตัดขน / คลินิกสัตว์)',
  beauty_clinic: 'คลินิกความงาม / ทันตกรรม',
  car_care: 'คาร์แคร์ / ล้างรถ',
  photo_studio: 'สตูดิโอถ่ายภาพ',
  tutoring: 'คลาสเรียน / ติวเตอร์',
  event: 'งานอีเวนต์ / สัมมนา / บูธ',
};

/**
 * Raw values seen in the wild → normalized key. Keys are compared
 * case-insensitively after trimming.
 */
const ALIASES: Record<string, BusinessType> = {
  // registration `business_category`
  'ร้านตัดผม': 'salon',
  'ร้านทำเล็บ': 'nail',
  'คลินิก': 'clinic',
  'ร้านอาหาร': 'restaurant',
  buffet: 'buffet',
  fitness: 'fitness',
  meeting_room: 'meeting_room',
  'ร้านซ่อมรถ': 'auto_repair',
  'ร้านซ่อมมือถือ': 'mobile_repair',
  'ทีมช่างติดตั้ง': 'field_service',
  'งานราชการ': 'government',
  consult: 'consult',
  'สปา': 'spa',
  'นวด': 'spa',
  'สนามกีฬา': 'sports_court',
  'สนามแบด': 'sports_court',
  'บีบีกัน': 'outdoor',
  'สัตว์เลี้ยง': 'pet',
  'ทันตกรรม': 'beauty_clinic',
  'คลินิกความงาม': 'beauty_clinic',
  'ล้างรถ': 'car_care',
  'คาร์แคร์': 'car_care',
  'สตูดิโอ': 'photo_studio',
  'ติวเตอร์': 'tutoring',
  'อีเวนต์': 'event',
  // demo `demo_business_type`
  barber: 'salon',
  restaurant: 'restaurant',
  clinic: 'clinic',
};

/** Type guard for a normalized business type key. */
export function isBusinessType(value: unknown): value is BusinessType {
  return typeof value === 'string' && (BUSINESS_TYPES as readonly string[]).includes(value);
}

/**
 * Map a registration category, demo business type, or already-normalized key
 * to a `BusinessType`. Unknown values (including `general_service`) return null.
 *
 * @param raw - Any stored or user-entered business label.
 */
export function normalizeBusinessType(raw: string | null | undefined): BusinessType | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (isBusinessType(trimmed)) return trimmed;
  const lower = trimmed.toLowerCase();
  if (isBusinessType(lower)) return lower;
  return ALIASES[trimmed] ?? ALIASES[lower] ?? null;
}
