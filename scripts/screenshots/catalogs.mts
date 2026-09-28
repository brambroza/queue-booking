/**
 * Sample shops, one per business type shown on the use-case and solution pages.
 *
 * The capture script serves these in place of the demo shop's own branches,
 * services and resources, so each page gets screenshots that match its
 * business. Shop names are fictional. Ids are fixed so runs are repeatable.
 */
import type { ShopCatalog } from './fixtures.mts';

export type BusinessKey = 'barber' | 'clinic' | 'restaurant' | 'buffet' | 'meeting-room' | 'badminton' | 'tennis' | 'bb-gun';

export type SampleService = { id: string; service_name: string; duration_minutes: number; price: number; image_url: null };

export type SampleResource = {
  id: string;
  branch_id: string;
  resource_name: string;
  resource_code: string | null;
  resource_type: string;
  capacity: number;
  unit_price: number | null;
  service_ids: null;
  image_urls: null;
  floor: string | null;
  zone: string | null;
  description: null;
  active: true;
};

export type BusinessCatalog = ShopCatalog & {
  key: BusinessKey;
  shopName: string;
  /** One of SIGNAGE_THEMES in src/lib/signage/types.ts. */
  signageTheme: string;
  branches: Array<{ id: string; branch_name: string; layout_image_url: null }>;
  services: SampleService[];
  resources: SampleResource[];
};

type ServiceSeed = [name: string, minutes: number, price: number];
type ResourceSeed = { name: string; code?: string; capacity?: number; floor?: string; zone?: string };

/**
 * Deterministic UUID-shaped id, so the pages' own id handling sees a normal value.
 * @param business Index of the business.
 * @param group 1 = branch, 2 = service, 3 = resource.
 * @param index Position within the group.
 * @returns A fixed UUID string.
 */
function sampleId(business: number, group: number, index: number): string {
  const tail = String(business * 10_000 + group * 100 + index).padStart(12, '0');
  return `00000000-0000-4000-8000-${tail}`;
}

/**
 * Build one business catalog from short seeds.
 * @param index Position of the business, used for ids.
 * @param key Business key, also the output folder name.
 * @param shopName Fictional shop name.
 * @param branchName Branch name.
 * @param signageTheme Signage theme for this business.
 * @param resourceType Resource type shared by the shop's resources.
 * @param services Service seeds.
 * @param resources Resource seeds.
 * @returns The catalog.
 */
function business(
  index: number,
  key: BusinessKey,
  shopName: string,
  branchName: string,
  signageTheme: string,
  resourceType: string,
  services: ServiceSeed[],
  resources: ResourceSeed[],
): BusinessCatalog {
  const branchId = sampleId(index, 1, 1);
  return {
    key,
    shopName,
    signageTheme,
    branches: [{ id: branchId, branch_name: branchName, layout_image_url: null }],
    services: services.map(([service_name, duration_minutes, price], i) => ({
      id: sampleId(index, 2, i + 1),
      service_name,
      duration_minutes,
      price,
      image_url: null,
    })),
    resources: resources.map((r, i) => ({
      id: sampleId(index, 3, i + 1),
      branch_id: branchId,
      resource_name: r.name,
      resource_code: r.code ?? null,
      resource_type: resourceType,
      capacity: r.capacity ?? 1,
      unit_price: null,
      service_ids: null,
      image_urls: null,
      floor: r.floor ?? null,
      zone: r.zone ?? null,
      description: null,
      active: true,
    })),
  };
}

export const BUSINESSES: BusinessCatalog[] = [
  business(
    1,
    'barber',
    'ตัดผมชาย บ้านช่าง',
    'สาขาอารีย์',
    'emerald',
    'service_area',
    [
      ['ตัดผมชาย', 30, 250],
      ['ตัดผม + สระไดร์', 60, 400],
      ['ตัดผม + โกนหนวด', 45, 350],
    ],
    [{ name: 'ช่างเอส', code: 'เก้าอี้ 1' }, { name: 'ช่างโต', code: 'เก้าอี้ 2' }, { name: 'ช่างนนท์', code: 'เก้าอี้ 3' }],
  ),
  business(
    2,
    'clinic',
    'สุขใจคลินิก',
    'สาขาลาดพร้าว',
    'clinic',
    'service_area',
    [
      ['ตรวจสุขภาพทั่วไป', 30, 500],
      ['พบทันตแพทย์', 45, 800],
      ['ตรวจและฉีดวัคซีน', 15, 650],
      ['ปรึกษาแพทย์', 30, 400],
    ],
    [{ name: 'ห้องตรวจ 1', floor: '1' }, { name: 'ห้องตรวจ 2', floor: '1' }, { name: 'ห้องทันตกรรม', floor: '2' }],
  ),
  business(
    3,
    'restaurant',
    'ครัวคุณแม่',
    'สาขาลาดพร้าว',
    'restaurant',
    'table',
    [
      ['จองโต๊ะ 2 ที่นั่ง', 90, 0],
      ['จองโต๊ะ 4 ที่นั่ง', 90, 0],
      ['จองโต๊ะ 6-8 ที่นั่ง', 120, 0],
      ['คิวหน้าร้าน (Walk-in)', 60, 0],
    ],
    [
      { name: 'โต๊ะ 3', capacity: 2, zone: 'ริมหน้าต่าง' },
      { name: 'โต๊ะ 7', capacity: 4, zone: 'ในร้าน' },
      { name: 'โต๊ะ 12', capacity: 6, zone: 'ในร้าน' },
      { name: 'โต๊ะ 15', capacity: 8, zone: 'ห้องส่วนตัว' },
    ],
  ),
  business(
    4,
    'buffet',
    'ชาบูอิ่มอร่อย',
    'สาขาบางนา',
    'restaurant',
    'buffet_zone',
    [
      ['บุฟเฟ่ต์รอบเที่ยง', 90, 399],
      ['บุฟเฟ่ต์รอบเย็น', 90, 499],
      ['บุฟเฟ่ต์พรีเมียม', 120, 699],
      ['คิวหน้าร้าน (Walk-in)', 90, 0],
    ],
    [
      { name: 'โซน A', capacity: 4 },
      { name: 'โซน B', capacity: 6 },
      { name: 'โซน C', capacity: 8 },
    ],
  ),
  business(
    5,
    'meeting-room',
    'The Hub Co-working',
    'สาขาสาทร',
    'meeting',
    'meeting_room',
    [
      ['จองห้องประชุม 1 ชั่วโมง', 60, 300],
      ['จองห้องประชุมครึ่งวัน', 240, 1000],
      ['จองห้องประชุมเต็มวัน', 480, 1800],
    ],
    [
      { name: 'ห้อง Focus', capacity: 4, floor: '3' },
      { name: 'ห้อง Team', capacity: 8, floor: '3' },
      { name: 'ห้อง Board', capacity: 14, floor: '5' },
    ],
  ),
  business(
    6,
    'badminton',
    'สมาร์ทแบดมินตัน',
    'สาขารามอินทรา',
    'emerald',
    'court',
    [
      ['เช่าสนาม 1 ชั่วโมง', 60, 180],
      ['เช่าสนาม 2 ชั่วโมง', 120, 340],
      ['คอร์สเรียนกับโค้ช', 60, 500],
    ],
    [
      { name: 'สนาม 1', capacity: 4 },
      { name: 'สนาม 2', capacity: 4 },
      { name: 'สนาม 3', capacity: 4 },
      { name: 'สนาม 4', capacity: 4 },
    ],
  ),
  business(
    7,
    'tennis',
    'กรีนคอร์ท เทนนิส',
    'สาขาพระราม 9',
    'emerald',
    'court',
    [
      ['เช่าคอร์ท 1 ชั่วโมง', 60, 400],
      ['เช่าคอร์ท 2 ชั่วโมง', 120, 750],
      ['คลาสเรียนกับโค้ช', 60, 900],
    ],
    [
      { name: 'คอร์ท 1', capacity: 4, zone: 'Indoor' },
      { name: 'คอร์ท 2', capacity: 4, zone: 'Indoor' },
      { name: 'คอร์ท 3', capacity: 4, zone: 'Outdoor' },
    ],
  ),
  business(
    8,
    'bb-gun',
    'แทคติคอล ฟิลด์',
    'สนามบางใหญ่',
    'midnight',
    'court',
    [
      ['จองรอบเกม 2 ชั่วโมง', 120, 350],
      ['เหมาสนามครึ่งวัน', 240, 6000],
      ['เช่าอุปกรณ์ครบชุด', 120, 250],
    ],
    [
      { name: 'สนามป่า', capacity: 20, zone: 'Outdoor' },
      { name: 'สนาม CQB', capacity: 12, zone: 'Indoor' },
    ],
  ),
];

/**
 * Find a business catalog by key.
 * @param key Business key from the command line.
 * @returns The catalog, or undefined for an unknown key.
 */
export function findBusiness(key: string): BusinessCatalog | undefined {
  return BUSINESSES.find((b) => b.key === key);
}

/**
 * Time slots for the LIFF time picker: a fixed working day where the morning
 * has passed and two afternoon slots are full, so every slot state is on screen.
 * @param date Booking date as YYYY-MM-DD.
 * @returns Body in the shape `/slots` returns.
 */
export function sampleSlots(date: string): unknown {
  const full = new Set(['14:00', '16:30']);
  const times: string[] = [];
  for (let minutes = 9 * 60; minutes <= 17 * 60 + 30; minutes += 30) {
    times.push(`${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`);
  }
  const slots = times.map((time) => {
    const isFull = full.has(time);
    return {
      slot_time: `${time}:00`,
      capacity: 2,
      booked_count: isFull ? 2 : time.endsWith(':30') ? 1 : 0,
      remaining_capacity: isFull ? 0 : time.endsWith(':30') ? 1 : 2,
      is_past: time < '13:00',
    };
  });
  return {
    data: slots,
    meta: {
      reason: 'ok',
      hint: '',
      open_slots: slots.filter((s) => !s.is_past && s.remaining_capacity > 0).length,
      today: date,
      has_working_hours: true,
      is_holiday: false,
    },
  };
}
