import type { BusinessScenario } from './types';

/** Phone / tablet / notebook repair shop: quick fixed-price jobs plus screen jobs the shop confirms by model. */
export const mobileRepairScenario: BusinessScenario = {
  type: 'mobile_repair',
  slug: 'mobile-repair',
  label: 'ร้านซ่อมมือถือ',
  icon: '📱',
  shopName: 'ฟิกซ์โฟน คลินิกมือถือ',
  branchName: 'สาขาแจ้งวัฒนะ (ในศูนย์การค้า ชั้น 4)',
  openTime: '10:00',
  closeTime: '21:00',
  slotMinutes: 30,
  resourceLabel: 'ช่าง',
  resourcePicker: 'optional',
  services: [
    { key: 'diagnose', name: 'ตรวจเช็คอาการเครื่อง', description: 'ช่างเปิดเช็คให้ฟรี แจ้งราคาก่อนซ่อม', icon: '🔍', durationMinutes: 20, price: 0, bookingMode: 'fixed_slot', capacityPerSlot: 2 },
    { key: 'battery', name: 'เปลี่ยนแบตเตอรี่', description: 'แบตคุณภาพสูง รับประกัน 6 เดือน รอรับได้', icon: '🔋', durationMinutes: 45, price: 890, bookingMode: 'fixed_slot', capacityPerSlot: 1 },
    { key: 'screen', name: 'เปลี่ยนจอมือถือ', description: 'ราคาตามรุ่น ร้านเช็คจอในสต็อกแล้วยืนยันคิว', icon: '📱', durationMinutes: 60, price: 0, bookingMode: 'request_approval', capacityPerSlot: 1 },
    { key: 'charging-port', name: 'ซ่อมช่องชาร์จ / ลำโพง', description: 'ชาร์จไม่เข้า เสียงเบา ทำเสร็จภายในวัน', icon: '🔌', durationMinutes: 60, price: 690, bookingMode: 'fixed_slot', capacityPerSlot: 1 },
    { key: 'film', name: 'ติดฟิล์มกระจก', description: 'รับคิวหน้าร้าน ไม่ต้องนัดล่วงหน้า', icon: '✨', durationMinutes: 15, price: 290, bookingMode: 'walk_in', capacityPerSlot: 3 },
  ],
  resources: [
    { code: 'T-TON', name: 'ช่างต้น', type: 'trainer', capacity: 1, serviceKeys: ['diagnose', 'screen', 'charging-port'], detail: 'งานบอร์ด · iPhone / iPad' },
    { code: 'T-FAH', name: 'ช่างฟ้า', type: 'trainer', capacity: 1, serviceKeys: ['diagnose', 'battery', 'screen'], detail: 'Android ทุกยี่ห้อ' },
    { code: 'T-BAS', name: 'ช่างบาส', type: 'trainer', capacity: 1, serviceKeys: ['battery', 'charging-port', 'film'], detail: 'งานด่วนหน้าร้าน · ติดฟิล์ม' },
  ],
  queues: [
    { queueNo: 'A001', serviceKey: 'battery', resourceCode: 'T-FAH', time: '10:30', status: 'completed', customerName: 'คุณกิ๊ฟ', phone: '0910008001', payment: { method: 'omise_promptpay', status: 'paid' } },
    { queueNo: 'A002', serviceKey: 'screen', resourceCode: 'T-TON', time: '11:00', status: 'serving', customerName: 'คุณโอ๊ต', phone: '0910008002' },
    { queueNo: 'A003', serviceKey: 'diagnose', time: '11:30', status: 'called', customerName: 'คุณป้าสมศรี', phone: '0910008003' },
    { queueNo: 'A004', serviceKey: 'film', resourceCode: 'T-BAS', time: '11:30', status: 'waiting', customerName: 'คุณมายด์', phone: '0910008004' },
    { queueNo: 'A005', serviceKey: 'charging-port', resourceCode: 'T-BAS', time: '13:00', status: 'confirmed', customerName: 'คุณเอ็ม', phone: '0910008005', payment: { method: 'omise_promptpay', status: 'paid' } },
    { queueNo: 'A006', serviceKey: 'screen', resourceCode: 'T-FAH', time: '14:00', status: 'pending_approval', customerName: 'คุณจูน', phone: '0910008006' },
  ],
  chats: [
    { role: 'customer', text: 'จอไอโฟน 13 แตก เปลี่ยนวันนี้ได้ไหมคะ' },
    { role: 'bot', text: 'กด "จองคิวซ่อม" เลือกเปลี่ยนจอมือถือได้เลยค่ะ ช่างเช็คจอรุ่นนี้ในสต็อกแล้วจะยืนยันคิวให้ทาง LINE' },
    { role: 'customer', text: 'ต้องทิ้งเครื่องไว้ไหม' },
    { role: 'bot', text: 'เปลี่ยนจอใช้เวลาประมาณ 1 ชั่วโมงค่ะ ส่วนใหญ่รอรับได้เลย ถึงร้านแล้วกด "ฉันมาถึงแล้ว" ในคิวของคุณได้ค่ะ' },
  ],
  promos: [
    { title: 'เปลี่ยนแบต แถมติดฟิล์มฟรี', subtitle: 'จองผ่าน LINE ภายในเดือนนี้', cta: 'จองคิวซ่อม' },
    { title: 'เช็คอาการฟรี ไม่ซ่อมไม่คิดเงิน', subtitle: 'จองเวลาไว้ ไม่ต้องรอหน้าร้าน', cta: 'จองเช็คเครื่อง' },
  ],
  signage: { template: 'classic', theme: 'midnight' },
  seo: {
    title: 'ทดลองระบบจองคิวร้านซ่อมมือถือ ผ่าน LINE',
    description: 'ทดลองระบบจองคิวร้านซ่อมมือถือผ่าน LINE ฟรี ไม่ต้องสมัคร ลูกค้านัดเปลี่ยนแบต เปลี่ยนจอ เลือกช่างเองได้ งานเปลี่ยนจอร้านยืนยันก่อน ไม่ต้องรอหน้าร้าน',
    h1: 'ทดลองระบบจองคิวร้านซ่อมมือถือผ่าน LINE',
    keywords: ['ระบบจองคิวร้านซ่อมมือถือ', 'นัดซ่อมมือถือผ่าน LINE', 'โปรแกรมร้านซ่อมโทรศัพท์', 'จองคิวเปลี่ยนจอมือถือ', 'ระบบคิวร้านซ่อมไอที'],
    answer:
      'ระบบจองคิวร้านซ่อมมือถือผ่าน LINE ให้ลูกค้าเลือกงานซ่อม เช่น เปลี่ยนแบตหรือเปลี่ยนจอ เลือกช่างหรือไม่ระบุ แล้วจองเวลาที่ว่างได้จาก LINE OA ของร้าน งานที่ต้องเช็คอะไหล่ตามรุ่นตั้งให้ร้านยืนยันก่อนได้ ลูกค้าจึงมาถึงแล้วซ่อมได้ทันที ไม่ต้องยืนรอหน้าร้าน',
    painPoints: [
      'ลูกค้าเดินมาพร้อมกันช่วงพักเที่ยงและหลังเลิกงาน ช่างไม่พอ',
      'ทักแชทถามราคาจอทีละรุ่น ตอบไม่ทันจนลูกค้าไปร้านอื่น',
      'ลูกค้ามาถึงแต่อะไหล่รุ่นนั้นหมด ต้องให้กลับไปก่อน',
    ],
    benefits: [
      'ลูกค้าจองเวลาซ่อมล่วงหน้า ร้านรู้จำนวนงานแต่ละช่วง',
      'ผูกช่างกับงานที่ถนัด ลูกค้าเลือกช่างที่เคยซ่อมให้ได้',
      'งานเปลี่ยนจอให้ร้านยืนยันหลังเช็คอะไหล่ ไม่ให้ลูกค้ามาเสียเที่ยว',
      'ติดฟิล์มรับคิวหน้าร้านได้ในระบบเดียวกัน',
    ],
    faqs: [
      { q: 'ร้านซ่อมมือถือให้ลูกค้าเลือกช่างที่ถนัด iPhone หรือ Android ได้ไหม', a: 'ได้ เพิ่มช่างแต่ละคนแล้วผูกว่าใครรับงานไหน ลูกค้าเห็นเฉพาะช่างที่ทำงานนั้นได้ หรือเลือก "ไม่ระบุ" ให้ร้านจัดช่างให้' },
      { q: 'งานเปลี่ยนจอมือถือที่ต้องเช็คอะไหล่ก่อน ตั้งคิวแบบไหน', a: 'ตั้งบริการเปลี่ยนจอเป็นแบบร้านต้องยืนยันก่อน คิวจะรออนุมัติจนพนักงานเช็คสต็อกแล้วกดยืนยัน ลูกค้าได้ข้อความยืนยันคิวใน LINE ทันที' },
      { q: 'ร้านซ่อมมือถือในห้างรับทั้งคิวนัดและลูกค้า walk-in พร้อมกันได้ไหม', a: 'ได้ บริการอย่างติดฟิล์มตั้งเป็นรับคิวหน้าร้านได้ ส่วนงานซ่อมให้จองเวลา พนักงานเรียกคิวจากหลังบ้านเดียวกันและลูกค้าได้ข้อความแจ้งใน LINE' },
      { q: 'ลูกค้าร้านซ่อมมือถือจ่ายค่าเปลี่ยนแบตตอนจองได้ไหม', a: 'ได้ เปิดรับชำระผ่าน PromptPay แอปธนาคาร หรือโอนแนบสลิป ระบบอ่าน QR บนสลิปและเตือนสลิปซ้ำให้ ร้านที่ไม่อยากเก็บเงินก่อนก็ปิดไว้ให้จ่ายหน้าร้านได้' },
      { q: 'ลูกค้าร้านซ่อมมือถือนัดแล้วไม่มา มีวิธีลดไหม', a: 'ตั้งให้ระบบส่ง LINE เตือนก่อนถึงนัดได้ตั้งแต่ 15 นาทีถึง 1 วัน ลูกค้าที่ไม่สะดวกกดยกเลิกเองใน LINE ได้ เวลานั้นจะกลับมาว่างให้คนอื่นจองทันที' },
    ],
    useCaseSlug: 'mobile-repair',
  },
};
