import type { BusinessScenario } from './types';

/** Sit-down restaurant: table booking by party size, private room on request, walk-in queue at the door. */
export const restaurantScenario: BusinessScenario = {
  type: 'restaurant',
  slug: 'restaurant',
  label: 'ร้านอาหาร',
  icon: '🍽️',
  shopName: 'ครัวริมคลอง บ้านสวน',
  branchName: 'สาขาราชพฤกษ์',
  openTime: '11:00',
  closeTime: '22:00',
  slotMinutes: 30,
  resourceLabel: 'โต๊ะ',
  resourcePicker: 'optional',
  partySize: { min: 1, max: 12, label: 'มากี่ท่าน' },
  services: [
    { key: 'table', name: 'จองโต๊ะทานที่ร้าน', description: 'เก็บโต๊ะให้ 15 นาทีจากเวลาจอง', icon: '🍽️', durationMinutes: 90, price: 0, bookingMode: 'capacity_based', capacityPerSlot: 6 },
    { key: 'private-room', name: 'ห้องส่วนตัว จัดเลี้ยง', description: 'ค่าจองห้อง 1,500 บาทต่อการจอง ค่าอาหารชำระที่ร้าน 8–12 ท่าน', icon: '🥂', durationMinutes: 150, price: 1500, bookingMode: 'request_approval', capacityPerSlot: 1 },
    { key: 'walk-in', name: 'รับคิวหน้าร้าน', description: 'มาถึงแล้วกดรับคิว รอเรียกผ่าน LINE', icon: '🧾', durationMinutes: 60, price: 0, bookingMode: 'walk_in', capacityPerSlot: 20 },
  ],
  resources: [
    { code: 'T1', name: 'โต๊ะ 1 ริมหน้าต่าง', type: 'table', capacity: 2, serviceKeys: ['table', 'walk-in'], detail: '2 ที่นั่ง · ในร้านแอร์' },
    { code: 'T2', name: 'โต๊ะ 2', type: 'table', capacity: 4, serviceKeys: ['table', 'walk-in'], detail: '4 ที่นั่ง · ในร้านแอร์' },
    { code: 'T5', name: 'โต๊ะ 5 ริมคลอง', type: 'table', capacity: 4, serviceKeys: ['table'], detail: '4 ที่นั่ง · ระเบียงเอาท์ดอร์' },
    { code: 'T8', name: 'โต๊ะกลม 8', type: 'table', capacity: 8, serviceKeys: ['table'], detail: '8 ที่นั่ง · มีถาดหมุน' },
    { code: 'VIP', name: 'ห้องเรือนไทย', type: 'service_area', capacity: 12, serviceKeys: ['private-room'], detail: 'ห้องแอร์ส่วนตัว · 12 ที่นั่ง' },
  ],
  queues: [
    { queueNo: 'A001', serviceKey: 'table', resourceCode: 'T5', time: '17:30', status: 'completed', customerName: 'คุณหนึ่ง', phone: '0820006001', partySize: 4 },
    { queueNo: 'A002', serviceKey: 'table', resourceCode: 'T8', time: '18:00', status: 'serving', customerName: 'ครอบครัวคุณสมชาย', phone: '0820006002', partySize: 7 },
    { queueNo: 'A003', serviceKey: 'walk-in', resourceCode: 'T2', time: '18:30', status: 'called', customerName: 'คุณฝน', phone: '0820006003', partySize: 3 },
    { queueNo: 'A004', serviceKey: 'walk-in', time: '18:30', status: 'waiting', customerName: 'คุณกอล์ฟ', phone: '0820006004', partySize: 2 },
    { queueNo: 'A005', serviceKey: 'table', resourceCode: 'T1', time: '19:00', status: 'checked_in', customerName: 'คุณมายด์', phone: '0820006005', partySize: 2 },
    { queueNo: 'A006', serviceKey: 'table', time: '19:30', status: 'confirmed', customerName: 'คุณเอก', phone: '0820006006', partySize: 5 },
    { queueNo: 'A007', serviceKey: 'private-room', resourceCode: 'VIP', time: '19:00', status: 'pending_approval', customerName: 'คุณวรรณ (เลี้ยงวันเกิดคุณแม่)', phone: '0820006007', partySize: 10, payment: { method: 'bank_transfer', status: 'awaiting_verification' } },
  ],
  chats: [
    { role: 'customer', text: 'เสาร์นี้ 1 ทุ่ม มา 6 คน มีโต๊ะริมคลองไหมคะ' },
    { role: 'bot', text: 'เสาร์นี้ 19:00 ยังมีโต๊ะว่างค่ะ กด "จองโต๊ะ" ที่เมนูด้านล่าง เลือกจำนวนท่านและโต๊ะที่ต้องการได้เลย' },
    { role: 'customer', text: 'ถ้าไปช้าโต๊ะจะหายไหม' },
    { role: 'bot', text: 'ร้านเก็บโต๊ะให้ 15 นาทีค่ะ ถ้าติดธุระกดยกเลิกในหน้าคิวของฉันได้เลย' },
  ],
  promos: [
    { title: 'เซ็ตปลากะพงทอดน้ำปลา ลด 15%', subtitle: 'จองโต๊ะผ่าน LINE มาก่อน 18:00 จันทร์–พฤหัส', cta: 'จองโต๊ะ' },
    { title: 'ห้องเรือนไทย เลี้ยงวันเกิด', subtitle: 'ฟรีเค้กปอนด์ เมื่อจองห้องล่วงหน้า 3 วัน', cta: 'จองห้อง' },
  ],
  signage: { template: 'classic', theme: 'restaurant' },
  seo: {
    title: 'ทดลองระบบจองโต๊ะร้านอาหาร รับคิวหน้าร้านผ่าน LINE',
    description: 'ทดลองระบบจองโต๊ะร้านอาหารผ่าน LINE ฟรี ไม่ต้องสมัคร ลูกค้าบอกจำนวนคน เลือกโต๊ะเอง รับคิวหน้าร้านแล้วรอเรียกในไลน์ ไม่ต้องยืนออกันหน้าประตู',
    h1: 'ทดลองระบบจองโต๊ะร้านอาหารผ่าน LINE',
    keywords: ['ระบบจองโต๊ะร้านอาหาร', 'จองโต๊ะผ่าน LINE', 'ระบบคิวร้านอาหาร', 'โปรแกรมจองโต๊ะ', 'ระบบเรียกคิวหน้าร้านอาหาร', 'จองโต๊ะออนไลน์'],
    answer:
      'ระบบจองโต๊ะร้านอาหารผ่าน LINE ให้ลูกค้าเลือกวัน เวลา จำนวนคน และโต๊ะที่ต้องการจาก LINE OA ของร้าน โดยรอบที่โต๊ะเต็มแล้วจะจองไม่ได้ ลูกค้าที่มาหน้าร้านก็กดรับคิวแล้วรอเรียกผ่าน LINE ได้ ร้านเห็นคิวจองและคิวหน้าร้านรวมในหน้าเดียว',
    painPoints: [
      'โทรจองโต๊ะช่วงเย็นสายไม่ว่าง พนักงานต้องวางมือจากหน้าร้าน',
      'ลูกค้ายืนออหน้าร้าน ไม่รู้ว่าอีกกี่คิว บางคนรอไม่ไหวกลับไปก่อน',
      'จองห้องจัดเลี้ยงแล้วไม่มา ห้องว่างทั้งที่มีคนอยากจอง',
    ],
    benefits: [
      'ลูกค้าบอกจำนวนคนและเลือกโต๊ะในร้าน ริมคลอง หรือโต๊ะกลมเองได้',
      'คิวหน้าร้านรอใน LINE พนักงานกดเรียกแล้วลูกค้าได้ข้อความทันที',
      'เก็บค่าจองห้องจัดเลี้ยงตอนจองผ่าน PromptPay / แอปธนาคาร / โอนแนบสลิป ไม่จ่ายตามกำหนดระบบยกเลิกคิวให้',
      'ลูกค้าที่นั่งในร้านสั่งอาหาร เรียกพนักงาน หรือขอเช็คบิลจาก LINE ได้ (แพ็กเกจ Professional ขึ้นไป)',
    ],
    faqs: [
      { q: 'ระบบจองโต๊ะร้านอาหารผ่าน LINE ให้ลูกค้าระบุจำนวนคนได้ไหม', a: 'ได้ ลูกค้าเลือกจำนวนท่านตอนจอง ร้านเห็นจำนวนคนของทุกคิว และกำหนดได้ว่าแต่ละรอบรับได้กี่โต๊ะ' },
      { q: 'ร้านอาหารใช้ทั้งจองโต๊ะล่วงหน้าและคิว walk-in หน้าร้านพร้อมกันได้ไหม', a: 'ได้ ตั้งบริการจองโต๊ะแบบรับจำนวนต่อรอบ และบริการรับคิวหน้าร้านแบบ walk-in คู่กัน ทั้งสองแบบขึ้นบนกระดานคิวเดียวกัน และแสดงบนจอทีวีหน้าร้านได้' },
      { q: 'ลูกค้าเลือกโต๊ะริมหน้าต่างหรือโซนเอาท์ดอร์ในร้านอาหารเองได้ไหม', a: 'ได้ เพิ่มโต๊ะพร้อมรูปและรายละเอียด เช่น จำนวนที่นั่งหรือโซน ลูกค้าเลือกโต๊ะเองหรือเลือก "ไม่ระบุ" ให้ร้านจัดให้ก็ได้' },
      { q: 'ร้านอาหารเก็บค่าจองห้องจัดเลี้ยงผ่าน LINE ได้อย่างไร', a: 'ตั้งราคาให้บริการจองห้อง ลูกค้าชำระเต็มจำนวนผ่าน PromptPay แอปธนาคาร หรือโอนแล้วแนบสลิปตอนจอง ระบบอ่าน QR บนสลิปและเตือนเมื่อเจอสลิปซ้ำ ถ้าไม่ชำระภายในเวลาที่กำหนด คิวจะถูกยกเลิกเอง' },
      { q: 'ลูกค้าที่นั่งในร้านอาหารสั่งอาหารผ่าน LINE ได้ไหม', a: 'ได้ในแพ็กเกจ Professional ขึ้นไป ลูกค้าที่เช็คอินแล้วสั่งอาหาร เรียกพนักงาน หรือขอเช็คบิลจาก LINE ได้ และพนักงานเห็นออเดอร์บนกระดานในหลังบ้าน' },
    ],
    useCaseSlug: 'restaurant',
    solutionPath: '/solutions/restaurant-booking-system',
  },
};
