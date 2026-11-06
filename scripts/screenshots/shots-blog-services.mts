/**
 * Shots for the November 2026 blog posts: pet grooming, car care, and the
 * Google Sheet queue display for vet hospitals.
 *
 * Display shots answer the `/display` feed with sample queues (clock frozen at
 * 18:30 Bangkok time); LIFF shots serve the `pet` / `car-care` sample catalogs.
 * Neither needs a portal login. Every name below is fictional and nothing is
 * written.
 *
 * Output: public/images/product/pet-grooming/, car-care/, sheet-signage/.
 */

import { CAPTURE_TIME, feed, person, type Scene } from './shots-signage-scenes.mts';
import type { Shot, Viewport } from './shots.mts';

const DISPLAY_FEED = '/api/public/shop/{shopKey}/display';
const TV: Viewport = { width: 1920, height: 1080 };
const MOBILE: Viewport = { width: 390, height: 844 };

/**
 * One full-screen capture of the display page on a sample feed.
 * @param name Shot name.
 * @param dir Output sub-folder.
 * @param scene Scene to show.
 * @returns The shot.
 */
function display(name: string, dir: string, scene: () => Scene): Shot {
  return { name, kind: 'display', path: '/display/{shopKey}', viewport: TV, dir, fixedTime: CAPTURE_TIME, routes: { [DISPLAY_FEED]: feed(scene) } };
}

/** Grooming shop: two groomers, pets called by name. */
const groomingFloor = (): Scene => ({
  shopName: 'บ้านขนฟู กรูมมิ่ง',
  branchName: 'สาขาสุขุมวิท 77',
  template: 'lane',
  theme: 'day_teal',
  serviceDone: 8,
  resources: ['ช่างแนน', 'ช่างบอส'],
  calling: [
    person('A009', 'called', 0, 90, '🐱 ส้มจี๊ด', 'อาบน้ำแมว', 'ช่างบอส'),
    person('A008', 'serving', -60, 150, '🐶 ข้าวตู', 'อาบน้ำ + ตัดขน สุนัขใหญ่', 'ช่างแนน'),
  ],
  waiting: [
    person('A010', 'confirmed', 30, 60, '🐶 โมจิ', 'อาบน้ำ สุนัขเล็ก', 'ช่างแนน'),
    person('A011', 'confirmed', 60, 90, '🐶 บราวนี่', 'อาบน้ำ สุนัขกลาง', null),
    person('A012', 'confirmed', 90, 60, '🐶 ถั่วแดง', 'อาบน้ำ สุนัขเล็ก', null),
  ],
});

const CAR = 'ล้างสี + ดูดฝุ่น';

/** Car care: three wash bays on the timeline, one long polish job. */
const carCareTimeline = (): Scene => ({
  shopName: 'ใสปิ๊ง คาร์แคร์',
  branchName: 'สาขาบางนา',
  template: 'timeline',
  theme: 'day_indigo',
  serviceDone: 14,
  resources: ['ช่องล้าง 1', 'ช่องล้าง 2', 'ช่องล้าง 3'],
  calling: [
    person('A015', 'called', 0, 60, 'กข 1234', `${CAR} รถเก๋ง`, 'ช่องล้าง 2'),
    person('A014', 'serving', -45, 90, 'ฒข 5678', `${CAR} รถกระบะ`, 'ช่องล้าง 1'),
    person('A013', 'serving', -90, 180, 'ขัดสี', 'ขัดสี', 'ช่องล้าง 3'),
  ],
  waiting: [
    person('A016', 'confirmed', 45, 75, 'SUV ขาว', `${CAR} รถ SUV`, 'ช่องล้าง 1'),
    person('A017', 'confirmed', 60, 60, 'เก๋งแดง', `${CAR} รถเก๋ง`, 'ช่องล้าง 2'),
    person('A018', 'confirmed', 90, 60, 'เก๋งเทา', `${CAR} รถเก๋ง`, 'ช่องล้าง 3'),
  ],
  extraSchedule: [person('A011', 'completed', -150, 60, 'เก๋งดำ', `${CAR} รถเก๋ง`, 'ช่องล้าง 1'), person('A012', 'completed', -90, 75, 'SUV ดำ', `${CAR} รถ SUV`, 'ช่องล้าง 2')],
});

/**
 * Vet hospital fed by a Google Sheet: pet names with species icons, and an
 * emergency case at the front of the line, the way the sheet parser builds them.
 * @param template Signage template.
 * @returns Scene builder.
 */
const vetSheet = (template: string) => (): Scene => ({
  shopName: 'โรงพยาบาลสัตว์รักษ์สี่ขา',
  branchName: 'สาขาพัฒนาการ',
  template,
  theme: template === 'flap' ? 'midnight' : 'day_teal',
  serviceDone: 17,
  resources: ['ห้องตรวจ 1', 'ห้องตรวจ 2', 'ห้องตรวจ 3'],
  calling: [
    person('V024', 'called', 0, 30, '🐶 ปุยฝ้าย', 'ตรวจทั่วไป', 'ห้องตรวจ 2'),
    person('V023', 'serving', -15, 30, '🐱 มะขาม', 'ฉีดวัคซีน', 'ห้องตรวจ 1'),
  ],
  waiting: [
    person('V031', 'waiting', 30, 30, '🚨 ลัคกี้', 'ฉุกเฉิน · ตรวจทั่วไป', null),
    person('V025', 'waiting', 15, 30, '🐰 ขนมปัง', 'ตรวจทั่วไป', null),
    person('V026', 'waiting', 15, 30, '🐶 ช็อกโก้', 'ทำแผล', null),
    person('V027', 'waiting', 30, 30, '🐱 นมเย็น', 'ฉีดวัคซีน', null),
    person('V028', 'waiting', 45, 30, '🐦 กีวี่', 'ตรวจทั่วไป', null),
  ],
});

const LIFF_BASE: Pick<Shot, 'kind' | 'path' | 'viewport'> = { kind: 'liff', path: '/liff/{shopKey}', viewport: MOBILE };

export const BLOG_SERVICES: Shot[] = [
  display('pet-display-lane', 'pet-grooming', groomingFloor),
  { ...LIFF_BASE, name: 'pet-liff-services', business: 'pet', dir: 'pet-grooming', waitForText: 'อาบน้ำแมว' },
  { ...LIFF_BASE, name: 'pet-liff-slots', business: 'pet', dir: 'pet-grooming', clickTexts: ['ช่างแนน', 'ถัดไป: เลือกคิว'], waitForText: 'เวลาว่าง ·', scrollToText: 'เวลาว่าง ·' },
  display('carcare-display-timeline', 'car-care', carCareTimeline),
  { ...LIFF_BASE, name: 'carcare-liff-services', business: 'car-care', dir: 'car-care', waitForText: 'ขัดสี' },
  display('sheet-display-board', 'sheet-signage', vetSheet('classic')),
  display('sheet-display-flap', 'sheet-signage', vetSheet('flap')),
];
