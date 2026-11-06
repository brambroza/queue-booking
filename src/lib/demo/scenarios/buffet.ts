import type { BusinessScenario } from './types';

/** Grill / shabu buffet sold in timed rounds, seats counted per round, group parties on request. */
export const buffetScenario: BusinessScenario = {
  type: 'buffet',
  slug: 'buffet',
  label: 'ร้านบุฟเฟ่ต์',
  icon: '🍲',
  shopName: 'ควันฉุย หมูกระทะ & ชาบู',
  branchName: 'สาขาบางนา',
  openTime: '11:00',
  closeTime: '23:00',
  slotMinutes: 60,
  resourceLabel: 'โซน',
  resourcePicker: 'optional',
  partySize: { min: 1, max: 20, label: 'จำนวนท่าน' },
  services: [
    { key: 'standard', name: 'บุฟเฟ่ต์หมูกระทะ รอบ 90 นาที', description: 'ราคาบุฟเฟ่ต์ 399 บาท/ท่าน ชำระที่ร้าน จองรอบฟรี', icon: '🥓', durationMinutes: 90, price: 0, bookingMode: 'capacity_based', capacityPerSlot: 12 },
    { key: 'premium', name: 'บุฟเฟ่ต์พรีเมียม เนื้อวากิว รอบ 2 ชม.', description: 'ราคา 699 บาท/ท่าน รวมซีฟู้ดและไอศกรีม ชำระที่ร้าน', icon: '🥩', durationMinutes: 120, price: 0, bookingMode: 'capacity_based', capacityPerSlot: 6 },
    { key: 'party', name: 'จองห้องปาร์ตี้ งานเลี้ยงกลุ่ม 10 ท่านขึ้นไป', description: 'ค่าจองห้อง 1,500 บาทต่อการจอง ค่าอาหารชำระที่ร้าน ร้านยืนยันเวลาให้ทาง LINE', icon: '🎉', durationMinutes: 120, price: 1500, bookingMode: 'request_approval', capacityPerSlot: 1 },
    { key: 'walk-in', name: 'รับคิวหน้าร้าน', description: 'มาถึงแล้วกดรับคิว ไม่ต้องยืนรอ', icon: '🧾', durationMinutes: 90, price: 0, bookingMode: 'walk_in', capacityPerSlot: 30 },
  ],
  resources: [
    { code: 'Z-AIR', name: 'โซนแอร์ ชั้น 1', type: 'buffet_zone', capacity: 48, serviceKeys: ['standard', 'premium', 'walk-in'], detail: 'เตาไฟฟ้า · ไม่มีควัน' },
    { code: 'Z-OUT', name: 'โซนลานสวน', type: 'buffet_zone', capacity: 40, serviceKeys: ['standard', 'walk-in'], detail: 'เตาถ่าน · มีพัดลมไอน้ำ' },
    { code: 'Z-PARTY', name: 'ห้องปาร์ตี้ ชั้น 2', type: 'buffet_zone', capacity: 24, serviceKeys: ['party', 'premium'], detail: 'ห้องปิด · มีจอคาราโอเกะ' },
  ],
  queues: [
    { queueNo: 'A001', serviceKey: 'standard', resourceCode: 'Z-OUT', time: '17:00', status: 'completed', customerName: 'คุณบอย', phone: '0830007001', partySize: 4 },
    { queueNo: 'A002', serviceKey: 'premium', resourceCode: 'Z-AIR', time: '18:00', status: 'serving', customerName: 'คุณแพรว', phone: '0830007002', partySize: 2 },
    { queueNo: 'A003', serviceKey: 'walk-in', time: '18:00', status: 'called', customerName: 'คุณตูน', phone: '0830007003', partySize: 5 },
    { queueNo: 'A004', serviceKey: 'walk-in', time: '18:00', status: 'waiting', customerName: 'คุณนิว', phone: '0830007004', partySize: 3 },
    { queueNo: 'A005', serviceKey: 'standard', resourceCode: 'Z-AIR', time: '19:00', status: 'confirmed', customerName: 'คุณจูน', phone: '0830007005', partySize: 6 },
    { queueNo: 'A006', serviceKey: 'party', resourceCode: 'Z-PARTY', time: '19:00', status: 'pending_approval', customerName: 'ทีมฝ่ายขาย บจก.รุ่งเรือง', phone: '0830007006', partySize: 16, payment: { method: 'bank_transfer', status: 'pending_payment' } },
  ],
  chats: [
    { role: 'customer', text: 'รอบ 1 ทุ่มวันศุกร์ ยังรับ 8 คนไหมครับ' },
    { role: 'bot', text: 'รอบ 19:00 วันศุกร์ยังว่างค่ะ กด "จองรอบบุฟเฟ่ต์" แล้วเลือกจำนวนท่านได้เลย รอบไหนเต็มจะขึ้นว่าเต็ม' },
    { role: 'customer', text: 'ทานได้กี่นาทีครับ' },
    { role: 'bot', text: 'รอบปกติ 90 นาที รอบพรีเมียม 2 ชั่วโมงค่ะ นับจากเวลาที่จองไว้' },
  ],
  promos: [
    { title: 'มา 4 จ่าย 3', subtitle: 'รอบ 14:00–16:00 จันทร์–ศุกร์ จองผ่าน LINE เท่านั้น', cta: 'จองรอบ' },
    { title: 'วันเกิดทานฟรี 1 ท่าน', subtitle: 'มาตั้งแต่ 5 ท่าน แสดงบัตรประชาชนเดือนเกิด', cta: 'จองงานเลี้ยง' },
  ],
  signage: { template: 'flap', theme: 'day_chili' },
  seo: {
    title: 'ทดลองระบบจองรอบบุฟเฟ่ต์ หมูกระทะ ชาบู ผ่าน LINE',
    description: 'ทดลองระบบจองรอบบุฟเฟ่ต์ผ่าน LINE ฟรี ไม่ต้องสมัคร คุมจำนวนที่นั่งต่อรอบ รอบเต็มจองไม่ได้ ลูกค้าหน้าร้านรับคิวแล้วรอเรียกในไลน์ ร้านไม่ต้องจดชื่อ',
    h1: 'ทดลองระบบจองรอบบุฟเฟ่ต์ผ่าน LINE',
    keywords: ['ระบบจองบุฟเฟ่ต์', 'จองรอบบุฟเฟ่ต์ผ่าน LINE', 'ระบบคิวร้านหมูกระทะ', 'ระบบจองโต๊ะชาบู', 'โปรแกรมคิวร้านบุฟเฟ่ต์'],
    answer:
      'ระบบจองรอบบุฟเฟ่ต์ผ่าน LINE ให้ลูกค้าเลือกรอบเวลา จำนวนท่าน และโซนที่นั่งจาก LINE OA ของร้าน ร้านกำหนดว่าแต่ละรอบรับได้กี่คิว พอครบแล้วรอบนั้นจะขึ้นว่าเต็ม คนที่มาหน้าร้านกดรับคิวแล้วรอเรียกผ่าน LINE ได้ไม่ต้องยืนรอ',
    painPoints: [
      'ช่วงหัวค่ำคนรอหน้าร้านยาว พนักงานต้องจดชื่อและตะโกนเรียก',
      'รับจองเกินที่นั่งในรอบเดียวกัน ลูกค้าที่จองมาแล้วยังต้องรอ',
      'กลุ่มใหญ่จองห้องแล้วเงียบหาย ร้านกันห้องไว้เสียเปล่า',
    ],
    benefits: [
      'ตั้งจำนวนคิวต่อรอบได้ รอบที่เต็มลูกค้าจองไม่ได้',
      'แยกบุฟเฟ่ต์ปกติกับพรีเมียมเป็นคนละบริการ เวลาทานต่างกัน',
      'กลุ่ม 10 ท่านขึ้นไปส่งคำขอ ร้านกดยืนยันก่อนเป็นคิวจริง',
      'เก็บค่าจองห้องปาร์ตี้ตอนจองผ่าน PromptPay / แอปธนาคาร / โอนแนบสลิป ไม่จ่ายตามกำหนดระบบยกเลิกคิวให้',
    ],
    faqs: [
      { q: 'ระบบจองบุฟเฟ่ต์ผ่าน LINE จำกัดจำนวนที่นั่งต่อรอบได้ไหม', a: 'ได้ ตั้งจำนวนคิวต่อรอบของแต่ละบริการ เมื่อครบแล้วรอบนั้นแสดงว่าเต็มและลูกค้าจองต่อไม่ได้ ลูกค้าจึงเห็นทันทีว่าควรเลือกรอบไหนแทน' },
      { q: 'ร้านหมูกระทะบุฟเฟ่ต์ให้ลูกค้าหน้าร้านรอคิวในไลน์ได้ไหม', a: 'ได้ ตั้งบริการรับคิวหน้าร้านแบบ walk-in ลูกค้าสแกน QR หรือกดเมนูรับคิว พอพนักงานกดเรียก ลูกค้าได้ข้อความใน LINE และเลขคิวขึ้นจอทีวีหน้าร้าน' },
      { q: 'ร้านชาบูบุฟเฟ่ต์รับจองงานเลี้ยงกลุ่มใหญ่ให้ร้านยืนยันก่อนได้ไหม', a: 'ได้ ตั้งบริการงานเลี้ยงให้ต้องรอร้านยืนยัน คิวจะอยู่ในสถานะรออนุมัติจนกว่าร้านกดยืนยัน แล้วลูกค้าได้ข้อความยืนยันใน LINE' },
      { q: 'ร้านบุฟเฟ่ต์ป้องกันลูกค้าจองหลายรอบในวันเดียวได้ไหม', a: 'ได้ เปิดตัวเลือกจำกัดให้ลูกค้าจองได้วันละ 1 คิว ระบบตรวจทั้งตอนจองและกันการกดซ้ำจากหลายเครื่อง ส่วนพนักงานยังลงคิวเพิ่มให้ได้จากหลังบ้าน' },
      { q: 'ร้านบุฟเฟ่ต์ส่งข้อความเตือนลูกค้าก่อนถึงรอบได้ไหม', a: 'ได้ เปิดการแจ้งเตือนล่วงหน้าแล้วเลือกเวลาได้ตั้งแต่ 15 นาทีถึง 1 วันก่อนรอบ ลูกค้าที่ไม่สะดวกกดยกเลิกจากข้อความได้เลย ที่นั่งจะว่างให้คนอื่นจอง' },
    ],
    useCaseSlug: 'buffet',
    solutionPath: '/solutions/buffet-booking-system',
  },
};
