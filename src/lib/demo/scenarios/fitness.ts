import type { BusinessScenario } from './types';

/** Boutique fitness studio: group classes by seats per round, personal training confirmed by the coach. */
export const fitnessScenario: BusinessScenario = {
  type: 'fitness',
  slug: 'fitness-class',
  label: 'ฟิตเนส / คลาสออกกำลังกาย',
  icon: '🏋️',
  shopName: 'ฟิตแอนด์เฟิร์ม สตูดิโอ',
  branchName: 'สาขาทองหล่อ',
  openTime: '06:00',
  closeTime: '22:00',
  slotMinutes: 60,
  resourceLabel: 'ครูผู้สอน',
  resourcePicker: 'optional',
  services: [
    { key: 'yoga', name: 'คลาสโยคะ Flow', description: 'ทุกระดับ มีเสื่อให้ยืม รับรอบละ 15 คน', icon: '🧘', durationMinutes: 60, price: 350, bookingMode: 'capacity_based', capacityPerSlot: 15 },
    { key: 'hiit', name: 'คลาส HIIT', description: 'คาร์ดิโอเข้มข้น 45 นาที รับรอบละ 12 คน', icon: '🔥', durationMinutes: 45, price: 300, bookingMode: 'capacity_based', capacityPerSlot: 12 },
    { key: 'reformer', name: 'พิลาทิส Reformer', description: 'เครื่อง 6 ตัว จองก่อนได้ก่อน', icon: '🤸', durationMinutes: 50, price: 650, bookingMode: 'capacity_based', capacityPerSlot: 6 },
    { key: 'pt', name: 'เทรนส่วนตัว (PT)', description: 'ตัวต่อตัวกับโค้ช โค้ชยืนยันเวลาให้', icon: '🏋️', durationMinutes: 60, price: 1200, bookingMode: 'request_approval', capacityPerSlot: 1 },
  ],
  resources: [
    { code: 'PRANG', name: 'ครูมะปราง', type: 'trainer', capacity: 1, serviceKeys: ['yoga', 'reformer'], detail: 'โยคะ พิลาทิส ครูสอน 8 ปี' },
    { code: 'BEER', name: 'โค้ชเบียร์', type: 'trainer', capacity: 1, serviceKeys: ['hiit', 'pt'], detail: 'HIIT ลดไขมัน เวทเทรนนิ่ง' },
    { code: 'TOP', name: 'โค้ชท็อป', type: 'trainer', capacity: 1, serviceKeys: ['pt'], detail: 'สร้างกล้ามเนื้อ ฟื้นฟูหลังบาดเจ็บ' },
  ],
  queues: [
    { queueNo: 'A001', serviceKey: 'yoga', time: '07:00', status: 'completed', customerName: 'คุณหญิง', nickname: 'หญิง', phone: '0880007001', payment: { method: 'omise_promptpay', status: 'paid' } },
    { queueNo: 'A002', serviceKey: 'reformer', time: '18:00', status: 'serving', customerName: 'คุณเมษ์', nickname: 'เมษ์', phone: '0880007002', payment: { method: 'omise_promptpay', status: 'paid' } },
    { queueNo: 'A003', serviceKey: 'hiit', time: '19:00', status: 'called', customerName: 'คุณต่อ', nickname: 'ต่อ', phone: '0880007003', payment: { method: 'omise_mobile_banking', status: 'paid' } },
    { queueNo: 'A004', serviceKey: 'hiit', time: '19:00', status: 'checked_in', customerName: 'คุณเพลง', nickname: 'เพลง', phone: '0880007004', payment: { method: 'omise_promptpay', status: 'paid' } },
    { queueNo: 'A005', serviceKey: 'hiit', time: '19:00', status: 'waiting', customerName: 'คุณนัท', nickname: 'นัท', phone: '0880007005', payment: { method: 'bank_transfer', status: 'paid' } },
    { queueNo: 'A006', serviceKey: 'yoga', time: '20:00', status: 'confirmed', customerName: 'คุณเอิง', nickname: 'เอิง', phone: '0880007006', payment: { method: 'bank_transfer', status: 'awaiting_verification' } },
    { queueNo: 'A007', serviceKey: 'pt', resourceCode: 'TOP', time: '20:00', status: 'pending_approval', customerName: 'คุณภูมิ', nickname: 'ภูมิ', phone: '0880007007', payment: { method: 'bank_transfer', status: 'pending_payment' } },
  ],
  chats: [
    { role: 'customer', text: 'คลาสโยคะคืนนี้ 2 ทุ่มยังเหลือที่ไหมคะ' },
    { role: 'bot', text: 'คลาสโยคะ 20:00 ยังไม่เต็มค่ะ กด "จองคลาส" ที่เมนูด้านล่าง แล้วชำระผ่าน PromptPay ได้เลย' },
    { role: 'customer', text: 'อยากเทรนส่วนตัวกับโค้ชท็อป ต้องทำยังไง' },
    { role: 'bot', text: 'เลือก "เทรนส่วนตัว (PT)" แล้วเลือกโค้ชท็อปได้เลยค่ะ โค้ชจะยืนยันเวลากลับทาง LINE' },
  ],
  promos: [
    { title: 'คลาสแรกลด 50%', subtitle: 'สำหรับสมาชิกใหม่ จองผ่าน LINE', cta: 'จองคลาส' },
    { title: 'Reformer รอบเช้า 7 โมง', subtitle: 'เปิดเพิ่มทุกวันจันทร์–ศุกร์', cta: 'ดูรอบว่าง' },
  ],
  signage: { template: 'board', theme: 'day_indigo' },
  seo: {
    title: 'ทดลองระบบจองคลาสฟิตเนส โยคะ ผ่าน LINE',
    description: 'ทดลองระบบจองคลาสฟิตเนสและโยคะผ่าน LINE ฟรี ไม่ต้องสมัคร สมาชิกจองรอบที่ยังว่างเอง คลาสเต็มขึ้นว่าเต็ม จ่ายผ่าน PromptPay เทรนส่วนตัวให้โค้ชยืนยันก่อน',
    h1: 'ทดลองระบบจองคลาสฟิตเนสผ่าน LINE',
    keywords: ['ระบบจองคลาสฟิตเนส', 'ระบบจองคลาสโยคะ', 'จองคลาสออกกำลังกายผ่าน LINE', 'โปรแกรมจองคลาสพิลาทิส', 'ระบบจองเทรนเนอร์ส่วนตัว'],
    answer:
      'ระบบจองคลาสฟิตเนสผ่าน LINE ให้สมาชิกเปิด LINE OA ของสตูดิโอ เลือกคลาสและรอบเวลา แล้วจองรอบที่ยังว่างได้เลย พอที่นั่งครบ รอบนั้นจะขึ้นว่าเต็ม สมาชิกจ่ายผ่าน PromptPay ได้ตอนจอง ส่วนเทรนส่วนตัวตั้งให้โค้ชยืนยันเวลาก่อนได้',
    painPoints: [
      'สมาชิกทักถามว่าคลาสเย็นนี้เต็มหรือยัง แอดมินต้องนับรายชื่อในแชทกลุ่ม',
      'คลาสฮิตคนล้น เครื่อง Reformer ไม่พอ ต้องให้สมาชิกกลับบ้าน',
      'จองแล้วไม่มา ที่ว่างในคลาสเสียไปทั้งที่มีคนอยากเข้า',
    ],
    benefits: [
      'ตั้งจำนวนที่ต่อรอบได้ รอบที่ครบแล้วขึ้นว่าเต็มอัตโนมัติ',
      'เก็บเงินค่าคลาสผ่าน PromptPay ตอนจอง ไม่จ่ายตามกำหนดระบบคืนที่ให้คนอื่น',
      'เปิดจองล่วงหน้าได้เฉพาะสัปดาห์นี้ หรือเปิดจองตามวันที่กำหนด',
      'ส่ง LINE เตือนก่อนคลาสเริ่ม สมาชิกกดยกเลิกจากข้อความได้ ที่ว่างกลับมาให้คนอื่นจอง',
    ],
    faqs: [
      { q: 'ระบบจองคลาสฟิตเนสจำกัดจำนวนคนต่อคลาสได้ไหม', a: 'ได้ ตั้งจำนวนที่ต่อรอบของแต่ละคลาสได้ เช่น โยคะ 15 คน Reformer 6 คน พอครบจำนวน รอบนั้นจะขึ้นว่าเต็มใน LINE และสมาชิกเลือกรอบอื่นแทน' },
      { q: 'สมาชิกฟิตเนสจองหลายคลาสในครั้งเดียวได้ไหม', a: 'ได้เมื่อสตูดิโอเปิดสวิตช์จองหลายช่อง สมาชิกเลือกได้สูงสุด 4 รอบในการจองครั้งเดียว แต่ละรอบเป็นคิวแยกกันและยกเลิกแยกได้' },
      { q: 'สตูดิโอโยคะเปิดให้จองคลาสล่วงหน้าแค่ 7 วันได้ไหม', a: 'ได้ ตั้งระยะจองล่วงหน้าต่อสาขาได้ เช่น 1 สัปดาห์ หรือกำหนดช่วงวันที่เปิดจองแบบตายตัว ปฏิทินใน LINE จะโชว์เฉพาะวันที่จองได้' },
      { q: 'ฟิตเนสให้สมาชิกเลือกโค้ชเทรนส่วนตัวผ่าน LINE ได้ไหม', a: 'ได้ สมาชิกเลือกโค้ชจากรายชื่อ และตั้งบริการเทรนส่วนตัวให้โค้ชกดยืนยันก่อนได้ สมาชิกได้ข้อความแจ้งใน LINE เมื่อโค้ชยืนยัน' },
      { q: 'สตูดิโอฟิตเนสส่ง LINE ชวนสมาชิกที่หายไปให้กลับมาเข้าคลาสได้ไหม', a: 'ได้ในแพ็กเกจ Professional ขึ้นไป ระบบดูรอบที่สมาชิกเคยมาเข้าคลาส แล้วส่งข้อความชวนกลับทาง LINE เมื่อหายไปนานกว่าปกติ' },
    ],
    solutionPath: '/solutions/fitness-class-booking-system',
  },
};
