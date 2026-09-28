import type { ComponentType } from 'react';
import type { SignageTemplate } from '@/lib/signage/types';
import type { SignageTemplateProps } from '../template-props';
import { ClassicTemplate } from './classic';
import { SpotlightTemplate } from './spotlight';
import { CounterTemplate } from './counter';
import { BoardTemplate } from './board';
import { MinimalTemplate } from './minimal';
import { LaneTemplate } from './lane';
import { TimelineTemplate } from './timeline';
import { RouteTemplate } from './route';
import { FloorTemplate } from './floor';
import { InviteTemplate } from './invite';
import { FlapTemplate } from './flap';

export type SignageTemplateMeta = {
  id: SignageTemplate;
  component: ComponentType<SignageTemplateProps>;
  label_th: string;
  label_en: string;
  description_th: string;
  /** Demo business types this template is recommended for. */
  best_for: string[];
};

export const SIGNAGE_TEMPLATE_REGISTRY: Record<SignageTemplate, SignageTemplateMeta> = {
  classic: {
    id: 'classic',
    component: ClassicTemplate,
    label_th: 'คลาสสิก',
    label_en: 'Classic',
    description_th: 'คิวที่กำลังเรียกด้านซ้าย รายการคิวถัดไปด้านขวา ใช้ได้กับทุกธุรกิจ',
    best_for: ['barber', 'general_service'],
  },
  spotlight: {
    id: 'spotlight',
    component: SpotlightTemplate,
    label_th: 'สปอตไลท์',
    label_en: 'Spotlight',
    description_th: 'เลขคิวใหญ่กลางจอ อ่านได้จากอีกฝั่งร้าน เหมาะร้านอาหาร',
    best_for: ['restaurant'],
  },
  counter: {
    id: 'counter',
    component: CounterTemplate,
    label_th: 'หลายช่อง',
    label_en: 'Counter',
    description_th: 'การ์ดต่อห้อง/ช่าง/เคาน์เตอร์ แสดงว่าใครอยู่ช่องไหน เหมาะคลินิก ห้องประชุม',
    best_for: ['clinic', 'meeting_room'],
  },
  board: {
    id: 'board',
    component: BoardTemplate,
    label_th: 'ตารางคิว',
    label_en: 'Board',
    description_th: 'ตารางแบบสนามบิน เห็นคิวทั้งหมดในหน้าเดียว เหมาะบุฟเฟ่ต์ คิวเยอะ',
    best_for: ['buffet'],
  },
  minimal: {
    id: 'minimal',
    component: MinimalTemplate,
    label_th: 'มินิมอล',
    label_en: 'Minimal',
    description_th: 'เรียบ โล่ง ไม่มีกรอบ เข้ากับธีมสว่าง เหมาะร้านเล็บ บิวตี้ คาเฟ่',
    best_for: ['nail', 'beauty'],
  },
  lane: {
    id: 'lane',
    component: LaneTemplate,
    label_th: 'แถวคิว',
    label_en: 'Lane',
    description_th: 'ลูกค้าเป็นคนต่อแถว เดินไปจุดให้บริการเมื่อถูกเรียก เหมาะร้านที่ลูกค้ารอหน้าร้าน',
    best_for: ['restaurant', 'buffet', 'barber', 'nail'],
  },
  timeline: {
    id: 'timeline',
    component: TimelineTemplate,
    label_th: 'ตารางเวลา',
    label_en: 'Timeline',
    description_th: 'แถวละสนามหรือห้อง เห็นช่วงที่จองแล้วและช่วงที่ยังว่าง เหมาะสนามกีฬา ห้องประชุม',
    best_for: ['meeting_room', 'fitness', 'clinic'],
  },
  route: {
    id: 'route',
    component: RouteTemplate,
    label_th: 'เส้นทางคิว',
    label_en: 'Route',
    description_th: 'คิวเรียงเป็นสถานีบนเส้นทาง บอกเวลาที่เหลือก่อนถึงเวลานัด',
    best_for: ['restaurant', 'barber'],
  },
  floor: {
    id: 'floor',
    component: FloorTemplate,
    label_th: 'ผังจุดให้บริการ',
    label_en: 'Floor',
    description_th: 'เห็นทุกจุดให้บริการว่าว่างหรือไม่ มีเส้นนำทางไปจุดที่ถูกเรียก จัดเรียงอัตโนมัติ ไม่ใช่ผังร้านจริง',
    best_for: ['barber', 'nail', 'clinic'],
  },
  invite: {
    id: 'invite',
    component: InviteTemplate,
    label_th: 'เชิญชวน',
    label_en: 'Invite',
    description_th: 'ไม่มีคิวรอ จอเป็นป้ายชวนจองพร้อม QR ใหญ่ มีคิวเข้าแล้วกลับเป็นจอคิว ควรเปิด "แสดง QR"',
    best_for: ['nail', 'beauty', 'barber'],
  },
  flap: {
    id: 'flap',
    component: FlapTemplate,
    label_th: 'ป้ายพลิก',
    label_en: 'Split-flap',
    description_th: 'ป้ายพลิกแบบสนามบิน ช่องที่เปลี่ยนจะพลิก เหมาะคลินิกและร้านที่คิวยาว',
    best_for: ['clinic', 'buffet'],
  },
};

export const SIGNAGE_TEMPLATE_LIST: SignageTemplateMeta[] = Object.values(SIGNAGE_TEMPLATE_REGISTRY);
