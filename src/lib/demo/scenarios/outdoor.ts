import type { BusinessScenario } from './types';

/** BB gun field / outdoor activity: group rounds by field with party size, team building confirmed by the field. */
export const outdoorScenario: BusinessScenario = {
  type: 'outdoor',
  slug: 'bb-gun-outdoor',
  label: 'สนามบีบีกัน',
  icon: '🎯',
  shopName: 'ไฟร์ไลน์ บีบีกัน ฟิลด์',
  branchName: 'สาขาลำลูกกา คลอง 7',
  openTime: '09:00',
  closeTime: '18:00',
  slotMinutes: 60,
  resourceLabel: 'ฟิลด์',
  resourcePicker: 'optional',
  partySize: { min: 4, max: 30, label: 'จำนวนผู้เล่น' },
  services: [
    { key: 'standard-round', name: 'จองฟิลด์รอบมาตรฐาน 2 ชั่วโมง (ต่อกลุ่ม)', description: 'ค่าจอง 450 บาทต่อการจอง 1 กลุ่ม ค่าอุปกรณ์ตามจำนวนผู้เล่นชำระที่สนาม', icon: '🔫', durationMinutes: 120, price: 450, bookingMode: 'capacity_based', capacityPerSlot: 3 },
    { key: 'half-day', name: 'เหมาฟิลด์ครึ่งวัน', description: 'เล่นได้ 4 ชั่วโมง มีกรรมการคุมเกม 1 คน', icon: '🪖', durationMinutes: 240, price: 6900, bookingMode: 'fixed_slot', capacityPerSlot: 1 },
    { key: 'team-building', name: 'แพ็กเกจกิจกรรมบริษัท', description: 'ภารกิจทีม 10–30 คน สนามโทรยืนยันรายละเอียดก่อน', icon: '🏆', durationMinutes: 300, price: 0, bookingMode: 'request_approval', capacityPerSlot: 1 },
    { key: 'target-practice', name: 'ยิงเป้าซ้อมมือ', description: '30 นาที ลูก 300 นัด ไม่ต้องจองล่วงหน้า', icon: '🎯', durationMinutes: 30, price: 150, bookingMode: 'walk_in', capacityPerSlot: 6 },
  ],
  resources: [
    { code: 'F-JUNGLE', name: 'ฟิลด์ป่า', type: 'service_area', capacity: 20, serviceKeys: ['standard-round', 'half-day', 'team-building'], detail: 'ต้นไม้จริง บังเกอร์ไม้ · 20 คน' },
    { code: 'F-TOWN', name: 'ฟิลด์เมืองร้าง', type: 'service_area', capacity: 16, serviceKeys: ['standard-round', 'half-day', 'team-building'], detail: 'ตึกจำลอง 2 ชั้น · 16 คน' },
    { code: 'F-CQB', name: 'ฟิลด์ CQB ในร่ม', type: 'service_area', capacity: 10, serviceKeys: ['standard-round', 'half-day'], detail: 'ห้องแคบ เล่นได้ทั้งวันแม้ฝนตก · 10 คน' },
    { code: 'RANGE', name: 'ลานยิงเป้า', type: 'service_area', capacity: 6, serviceKeys: ['target-practice'], detail: 'เป้าเหล็ก 6 ช่อง' },
  ],
  queues: [
    { queueNo: 'A001', serviceKey: 'standard-round', resourceCode: 'F-JUNGLE', time: '09:00', status: 'completed', customerName: 'แก๊งเพื่อนมัธยม', phone: '0860002201', partySize: 8, payment: { method: 'omise_promptpay', status: 'paid' } },
    { queueNo: 'A002', serviceKey: 'half-day', resourceCode: 'F-TOWN', time: '10:00', status: 'serving', customerName: 'ทีมบอย', phone: '0860002202', partySize: 14, payment: { method: 'bank_transfer', status: 'paid' } },
    { queueNo: 'A003', serviceKey: 'standard-round', resourceCode: 'F-CQB', time: '11:00', status: 'called', customerName: 'คุณเฟิร์ส', phone: '0860002203', partySize: 6, payment: { method: 'omise_promptpay', status: 'paid' } },
    { queueNo: 'A004', serviceKey: 'target-practice', resourceCode: 'RANGE', time: '11:00', status: 'waiting', customerName: 'คุณนัท', phone: '0860002204', partySize: 2 },
    { queueNo: 'A005', serviceKey: 'standard-round', resourceCode: 'F-JUNGLE', time: '13:00', status: 'confirmed', customerName: 'ชมรมเดินป่าวันหยุด', phone: '0860002205', partySize: 12, payment: { method: 'omise_mobile_banking', status: 'paid' } },
    { queueNo: 'A006', serviceKey: 'team-building', resourceCode: 'F-TOWN', time: '13:00', status: 'pending_approval', customerName: 'บริษัท สยามพัสดุ จำกัด', phone: '0860002206', partySize: 25 },
  ],
  chats: [
    { role: 'customer', text: 'เสาร์นี้มากัน 10 คน มีรอบบ่ายว่างไหมครับ' },
    { role: 'bot', text: 'เสาร์นี้ 13:00 ยังว่างฟิลด์ป่าและฟิลด์เมืองร้างครับ กด "จองรอบ" ใส่จำนวนผู้เล่น 10 คน แล้วเลือกฟิลด์ได้เลย' },
    { role: 'customer', text: 'ต้องเตรียมอะไรไปบ้าง' },
    { role: 'bot', text: 'สนามมีปืน หน้ากาก และเสื้อกั๊กให้ครับ แนะนำใส่กางเกงขายาวกับรองเท้าผ้าใบ วันก่อนเล่นจะมีข้อความเตือนใน LINE' },
  ],
  promos: [
    { title: 'วันธรรมดา แถมลูกบีบี 500 นัด', subtitle: 'จองรอบมาตรฐานผ่าน LINE จันทร์–ศุกร์', cta: 'จองรอบ' },
    { title: 'แพ็กเกจกิจกรรมบริษัท', subtitle: 'ภารกิจทีม พร้อมกรรมการและอาหารว่าง', cta: 'ขอใบเสนอราคา' },
  ],
  signage: { template: 'flap', theme: 'day_lime' },
  seo: {
    title: 'ทดลองระบบจองสนามบีบีกัน กิจกรรม outdoor ผ่าน LINE',
    description: 'ทดลองระบบจองสนามบีบีกันผ่าน LINE ฟรี ไม่ต้องสมัคร ลูกค้าเลือกรอบ เลือกฟิลด์ ใส่จำนวนผู้เล่น จ่ายค่าจองก่อนมา งานกิจกรรมบริษัทสนามยืนยันก่อนรับ',
    h1: 'ทดลองระบบจองสนามบีบีกันผ่าน LINE',
    keywords: ['ระบบจองสนามบีบีกัน', 'จองสนาม BB Gun ผ่าน LINE', 'โปรแกรมจองกิจกรรม outdoor', 'ระบบจองรอบสนามยิงปืนบีบีกัน', 'จองกิจกรรม team building'],
    answer:
      'ระบบจองสนามบีบีกันผ่าน LINE ให้ลูกค้าเลือกรอบเวลา เลือกฟิลด์ และใส่จำนวนผู้เล่นได้เองจาก LINE OA ของสนาม รอบที่รับกลุ่มครบแล้วจะขึ้นว่าเต็ม จึงไม่มีกลุ่มมาชนกันในฟิลด์เดียว งานกิจกรรมบริษัทที่ต้องคุยรายละเอียดตั้งให้สนามยืนยันก่อนได้',
    painPoints: [
      'กลุ่มทักมาจองช่วงเสาร์อาทิตย์พร้อมกัน แอดมินไล่เช็คฟิลด์ว่างไม่ทัน',
      'จองไว้ 15 คน มาจริง 6 คน หรือเทกันทั้งกลุ่มตอนเช้า',
      'บริษัทขอจัดกิจกรรมแต่ข้อมูลกระจายอยู่หลายแชท',
    ],
    benefits: [
      'ลูกค้าใส่จำนวนผู้เล่นและเลือกฟิลด์เองตอนจอง',
      'กำหนดจำนวนกลุ่มต่อรอบ รอบที่เต็มขึ้นว่าเต็มทันที',
      'เก็บค่าจองต่อกลุ่มตอนจองผ่าน PromptPay / แอปธนาคาร / โอนแนบสลิป ไม่จ่ายตามกำหนดระบบยกเลิกคิวให้',
      'งานกิจกรรมบริษัทตั้งให้สนามยืนยันก่อน',
    ],
    faqs: [
      { q: 'ระบบจองสนามบีบีกัน ให้ลูกค้าใส่จำนวนผู้เล่นตอนจองได้ไหม', a: 'ได้ หน้าจองมีช่องจำนวนผู้เล่นตามช่วงที่สนามกำหนด เช่น 4–30 คน สนามเห็นจำนวนคนของแต่ละกลุ่มในหลังบ้านก่อนวันเล่น' },
      { q: 'สนามบีบีกันมีหลายฟิลด์ ให้ลูกค้าเลือกฟิลด์เองได้ไหม', a: 'ได้ ตั้งแต่ละฟิลด์พร้อมรูปและรายละเอียด ลูกค้าเลือกฟิลด์ที่ชอบหรือเลือก "ไม่ระบุ" ก็ได้ และสนามบังคับให้เลือกฟิลด์ก่อนจองได้ถ้าต้องการ' },
      { q: 'สนามบีบีกันรับหลายกลุ่มในรอบเดียวกันได้ไหม', a: 'ได้ ตั้งบริการเป็นแบบรับจำนวนต่อรอบ แล้วกำหนดว่ารอบหนึ่งรับได้กี่กลุ่ม เมื่อครบแล้วรอบนั้นจะขึ้นว่าเต็มในหน้าจอง' },
      { q: 'สนามบีบีกันเก็บค่าจองฟิลด์ก่อนวันเล่นได้ไหม', a: 'ได้ ตั้งราคาต่อการจองหนึ่งครั้ง (ไม่คูณจำนวนผู้เล่น) แล้วให้ลูกค้าจ่ายเต็มจำนวนผ่าน PromptPay แอปธนาคาร หรือโอนแนบสลิป ถ้าไม่จ่ายภายในเวลาที่กำหนด ระบบยกเลิกคิวและเปิดรอบนั้นให้กลุ่มอื่น' },
      { q: 'งานกิจกรรมบริษัทที่สนามบีบีกัน ต้องให้สนามยืนยันก่อนได้ไหม', a: 'ได้ ตั้งแพ็กเกจกิจกรรมบริษัทเป็นแบบร้านต้องยืนยันก่อน คิวจะรออนุมัติจนสนามคุยรายละเอียดแล้วกดยืนยัน ลูกค้าได้ข้อความยืนยันใน LINE' },
    ],
    solutionPath: '/solutions/bb-gun-field-booking-system',
  },
};
