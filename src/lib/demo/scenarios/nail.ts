import type { BusinessScenario } from './types';

/** Nail bar: gel and extensions on fixed slots, custom art from a reference photo confirmed by the shop. */
export const nailScenario: BusinessScenario = {
  type: 'nail',
  slug: 'nail-salon',
  label: 'ร้านทำเล็บ',
  icon: '💅',
  shopName: 'ลิตเติ้ลพิงค์ เนลบาร์',
  branchName: 'สาขาเซ็นทรัลพระราม 9 ชั้น 4',
  openTime: '10:00',
  closeTime: '21:00',
  slotMinutes: 30,
  resourceLabel: 'ช่าง',
  resourcePicker: 'optional',
  services: [
    { key: 'gel-hand', name: 'ทาสีเจลมือ', description: 'สีพื้น 1 สี ตัดหนัง ตะไบทรง', icon: '💅', durationMinutes: 60, price: 390, bookingMode: 'fixed_slot', capacityPerSlot: 2 },
    { key: 'gel-foot', name: 'ทาสีเจลเท้า + สปาเท้า', description: 'แช่เท้า ขัดส้น ทาสีเจล', icon: '🦶', durationMinutes: 75, price: 550, bookingMode: 'fixed_slot', capacityPerSlot: 1 },
    { key: 'extension', name: 'ต่อเล็บ PVC + เจล', description: 'ต่อทั้ง 10 นิ้ว เลือกทรงได้', icon: '✨', durationMinutes: 120, price: 890, bookingMode: 'fixed_slot', capacityPerSlot: 1 },
    { key: 'custom-art', name: 'เพ้นท์ลายตามรูป', description: 'ส่งรูปลายในแชท ร้านประเมินเวลาแล้วยืนยันคิว', icon: '🎨', durationMinutes: 120, price: 1200, bookingMode: 'request_approval', capacityPerSlot: 1 },
    { key: 'remove', name: 'ถอดเจล / ถอดเล็บต่อ', description: 'ถอดอย่างเดียว ไม่ทำสีใหม่', icon: '🧴', durationMinutes: 30, price: 150, bookingMode: 'fixed_slot', capacityPerSlot: 2 },
  ],
  resources: [
    { code: 'NING', name: 'ช่างนิ้ง', type: 'trainer', capacity: 1, detail: 'ต่อเล็บ ทรงอัลมอนด์ บัลเลต์' },
    { code: 'FAI', name: 'ช่างฝ้าย', type: 'trainer', capacity: 1, serviceKeys: ['gel-hand', 'custom-art', 'remove'], detail: 'เพ้นท์ลายมือ ลายการ์ตูน 3D' },
    { code: 'JANE', name: 'ช่างเจน', type: 'trainer', capacity: 1, serviceKeys: ['gel-hand', 'gel-foot', 'remove'], detail: 'งานเท้า สปาเท้า' },
  ],
  queues: [
    { queueNo: 'A001', serviceKey: 'gel-hand', resourceCode: 'FAI', time: '11:00', status: 'completed', customerName: 'คุณมายด์', nickname: 'มายด์', phone: '0830002001', payment: { method: 'omise_promptpay', status: 'paid' } },
    { queueNo: 'A002', serviceKey: 'extension', resourceCode: 'NING', time: '13:00', status: 'serving', customerName: 'คุณเฟิร์น', nickname: 'เฟิร์น', phone: '0830002002', payment: { method: 'bank_transfer', status: 'paid' } },
    { queueNo: 'A003', serviceKey: 'gel-foot', resourceCode: 'JANE', time: '13:30', status: 'called', customerName: 'คุณปุยฝ้าย', nickname: 'ปุย', phone: '0830002003', payment: { method: 'omise_promptpay', status: 'paid' } },
    { queueNo: 'A004', serviceKey: 'remove', time: '14:00', status: 'waiting', customerName: 'คุณเอม', nickname: 'เอม', phone: '0830002004' },
    { queueNo: 'A005', serviceKey: 'gel-hand', resourceCode: 'FAI', time: '15:00', status: 'checked_in', customerName: 'คุณขวัญ', nickname: 'ขวัญ', phone: '0830002005', payment: { method: 'omise_mobile_banking', status: 'paid' } },
    { queueNo: 'A006', serviceKey: 'custom-art', resourceCode: 'FAI', time: '17:00', status: 'pending_approval', customerName: 'คุณมินนี่', nickname: 'มินนี่', phone: '0830002006', payment: { method: 'bank_transfer', status: 'pending_payment' } },
  ],
  chats: [
    { role: 'customer', text: 'อยากทำลายตามรูปนี้ ใช้เวลานานไหมคะ' },
    { role: 'bot', text: 'จองบริการ "เพ้นท์ลายตามรูป" แล้วส่งรูปในแชทนี้ได้เลยค่ะ ช่างจะประเมินเวลาแล้วยืนยันคิวกลับทาง LINE' },
    { role: 'customer', text: 'เสาร์นี้มีคิวช่างนิ้งตอนบ่ายไหม' },
    { role: 'bot', text: 'เสาร์นี้ช่างนิ้งว่าง 13:00 กับ 16:30 ค่ะ กด "จองคิว" แล้วเลือกช่างนิ้งได้เลย' },
  ],
  promos: [
    { title: 'มือ + เท้า ลด 100 บาท', subtitle: 'จองเจลมือและเจลเท้าวันเดียวกัน', cta: 'จองคิว' },
    { title: 'สีใหม่ประจำเดือน', subtitle: 'โทนนู้ดชิมเมอร์ 12 สี มาแล้ว', cta: 'ดูคิวว่าง' },
  ],
  signage: { template: 'board', theme: 'nail' },
  seo: {
    title: 'ทดลองระบบจองคิวร้านทำเล็บผ่าน LINE',
    description: 'ทดลองระบบจองคิวร้านทำเล็บผ่าน LINE ฟรี ไม่ต้องสมัคร ลูกค้าเลือกช่างทำเล็บและเวลาว่างเอง จ่ายผ่าน PromptPay ตอนจองกันคิวหาย งานเพ้นท์ลายให้ร้านยืนยันก่อนได้',
    h1: 'ทดลองระบบจองคิวร้านทำเล็บผ่าน LINE',
    keywords: ['ระบบจองคิวร้านทำเล็บ', 'จองคิวทำเล็บผ่าน LINE', 'โปรแกรมจองคิวร้านเล็บ', 'ระบบนัดลูกค้าร้านทำเล็บ', 'จองคิวต่อเล็บออนไลน์'],
    answer:
      'ระบบจองคิวร้านทำเล็บผ่าน LINE ให้ลูกค้าเลือกบริการ เช่น ทาสีเจล ต่อเล็บ หรือสปาเท้า เลือกช่างที่ชอบ แล้วเลือกเวลาที่ยังว่างใน LINE OA ของร้านได้เลย ลูกค้าชำระค่าบริการผ่าน PromptPay ตอนจองได้ และตั้งงานเพ้นท์ลายตามรูปให้ช่างยืนยันก่อนรับคิว',
    painPoints: [
      'ลูกค้าส่งรูปลายมาถามราคาและเวลา ช่างตอบแชทระหว่างทำเล็บไม่ได้',
      'ลูกค้าประจำอยากได้ช่างคนเดิม แต่ร้านจดคิวในสมุดเลยชนกันบ่อย',
      'จองช่วงเย็นแล้วไม่มา ช่างนั่งว่างในชั่วโมงที่ขายดีที่สุด',
    ],
    benefits: [
      'ลูกค้าเลือกช่างคนเดิมได้เองและเห็นเฉพาะเวลาที่ช่างคนนั้นว่าง',
      'งานต่อเล็บกับงานเพ้นท์ตั้งเวลานานกว่าทาสีได้ คิวถัดไปไม่ทับ',
      'เก็บค่าบริการผ่าน PromptPay หรือโอนแนบสลิปตอนจอง ไม่จ่ายตามกำหนดระบบยกเลิกคิวให้',
      'งานลายยากตั้งให้ช่างดูรูปและกดยืนยันก่อน ลูกค้าได้ข้อความแจ้งใน LINE',
    ],
    faqs: [
      { q: 'ร้านทำเล็บให้ลูกค้าจ่ายเงินตอนจองคิวผ่าน LINE ได้ไหม', a: 'ได้ ลูกค้าจ่ายค่าบริการผ่าน PromptPay แอปธนาคาร หรือโอนแนบสลิปได้ตอนจอง ระบบอ่าน QR บนสลิปและเตือนสลิปซ้ำ ถ้าลูกค้าไม่จ่ายภายในเวลาที่กำหนด คิวจะถูกยกเลิกเองและช่องเวลากลับมาว่าง' },
      { q: 'ลูกค้าร้านทำเล็บจองช่างคนเดิมทุกครั้งได้ไหม', a: 'ได้ ลูกค้าเลือกช่างจากรายชื่อตอนจอง และเห็นเฉพาะเวลาที่ช่างคนนั้นยังว่าง ถ้าไม่ซีเรียสเรื่องช่างก็เลือก "ไม่ระบุ" ได้' },
      { q: 'งานเพ้นท์เล็บลายยาก ให้ช่างดูรูปก่อนรับคิวได้ไหม', a: 'ได้ ตั้งบริการนั้นเป็นแบบต้องให้ร้านอนุมัติ ลูกค้าส่งคำขอจองแล้วส่งรูปลายในแชท LINE ของร้าน ช่างดูแล้วกดยืนยัน ลูกค้าได้ข้อความแจ้งทันที' },
      { q: 'ร้านทำเล็บมีช่างไม่ทำเล็บเท้า ตั้งไม่ให้ลูกค้าจองผิดคนได้ไหม', a: 'ได้ ผูกได้ว่าช่างแต่ละคนให้บริการไหนบ้าง ตอนลูกค้าเลือกบริการเจลเท้า รายชื่อจะขึ้นเฉพาะช่างที่ทำงานเท้า' },
      { q: 'ร้านทำเล็บในห้างส่งข้อความเตือนลูกค้าก่อนถึงคิวได้ไหม', a: 'ได้ ตั้งให้ส่ง LINE เตือนล่วงหน้าตั้งแต่ 15 นาทีถึง 1 วันก่อนคิว ลูกค้ากดยกเลิกคิวจากข้อความได้เลย ร้านจึงรู้ก่อนและเปิดช่องให้คนอื่นจอง' },
    ],
    useCaseSlug: 'nail-salon',
    solutionPath: '/solutions/nail-salon-booking-system',
  },
};
