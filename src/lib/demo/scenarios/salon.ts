import type { BusinessScenario } from './types';

/** Hair salon / barber: short cuts on fixed slots, colour and straightening take longer and need the stylist's say. */
export const salonScenario: BusinessScenario = {
  type: 'salon',
  slug: 'salon',
  label: 'ร้านตัดผม / ซาลอน',
  icon: '💇',
  shopName: 'บ้านผมพลอย แฮร์ซาลอน',
  branchName: 'สาขาลาดพร้าว 71',
  openTime: '10:00',
  closeTime: '20:00',
  slotMinutes: 30,
  resourceLabel: 'ช่าง',
  resourcePicker: 'optional',
  services: [
    { key: 'men-cut', name: 'ตัดผมชาย', description: 'ตัด สระ เซ็ต ใช้เวลาประมาณ 30 นาที', icon: '💈', durationMinutes: 30, price: 200, bookingMode: 'fixed_slot', capacityPerSlot: 1 },
    { key: 'women-cut', name: 'ตัดผมหญิง + สระไดร์', description: 'ปรึกษาทรงกับช่างก่อนตัด', icon: '✂️', durationMinutes: 60, price: 450, bookingMode: 'fixed_slot', capacityPerSlot: 1 },
    { key: 'color', name: 'ทำสีผม', description: 'เวลาขึ้นกับความยาวผม 2–3 ชั่วโมง', icon: '🎨', durationMinutes: 150, price: 1800, bookingMode: 'flexible_duration', capacityPerSlot: 1 },
    { key: 'straighten', name: 'ยืดวอลลุ่ม / ดัดดิจิตอล', description: 'ร้านดูสภาพผมแล้วยืนยันคิวให้', icon: '🌀', durationMinutes: 180, price: 2500, bookingMode: 'request_approval', capacityPerSlot: 1 },
  ],
  resources: [
    { code: 'BOSS', name: 'ช่างบอส', type: 'trainer', capacity: 1, serviceKeys: ['men-cut', 'women-cut'], detail: 'ถนัดทรงชาย รองทรง สกินเฟด' },
    { code: 'ANN', name: 'ช่างแอน', type: 'trainer', capacity: 1, serviceKeys: ['women-cut', 'color', 'straighten'], detail: 'ทำสี ไฮไลต์ บาลายาจ' },
    { code: 'MAY', name: 'ช่างเมย์', type: 'trainer', capacity: 1, serviceKeys: ['women-cut', 'color', 'straighten'], detail: 'ยืด ดัด ผมเสีย ทำทรีตเมนต์' },
  ],
  queues: [
    { queueNo: 'A001', serviceKey: 'color', resourceCode: 'ANN', time: '10:30', status: 'completed', customerName: 'คุณฝน', nickname: 'ฝน', phone: '0820001001', payment: { method: 'omise_promptpay', status: 'paid' } },
    { queueNo: 'A002', serviceKey: 'men-cut', resourceCode: 'BOSS', time: '13:00', status: 'serving', customerName: 'คุณกอล์ฟ', nickname: 'กอล์ฟ', phone: '0820001002', payment: { method: 'omise_promptpay', status: 'paid' } },
    { queueNo: 'A003', serviceKey: 'women-cut', resourceCode: 'MAY', time: '13:00', status: 'called', customerName: 'คุณแพร', nickname: 'แพร', phone: '0820001003', payment: { method: 'bank_transfer', status: 'paid' } },
    { queueNo: 'A004', serviceKey: 'men-cut', time: '13:30', status: 'waiting', customerName: 'คุณโอ๊ต', nickname: 'โอ๊ต', phone: '0820001004', payment: { method: 'omise_mobile_banking', status: 'paid' } },
    { queueNo: 'A005', serviceKey: 'women-cut', resourceCode: 'ANN', time: '15:00', status: 'confirmed', customerName: 'คุณจูน', nickname: 'จูน', phone: '0820001005', payment: { method: 'bank_transfer', status: 'awaiting_verification' } },
    { queueNo: 'A006', serviceKey: 'straighten', resourceCode: 'MAY', time: '16:00', status: 'pending_approval', customerName: 'คุณน้ำหวาน', nickname: 'น้ำหวาน', phone: '0820001006', payment: { method: 'bank_transfer', status: 'pending_payment' } },
  ],
  chats: [
    { role: 'customer', text: 'พรุ่งนี้บ่ายสองมีคิวช่างบอสไหมครับ' },
    { role: 'bot', text: 'พรุ่งนี้ช่างบอสว่าง 14:00 และ 15:30 ค่ะ กด "จองคิว" ที่เมนูด้านล่าง แล้วเลือกช่างบอสได้เลย' },
    { role: 'customer', text: 'ถ้าจะยืดผมต้องจองยังไงคะ' },
    { role: 'bot', text: 'เลือกบริการ "ยืดวอลลุ่ม / ดัดดิจิตอล" แล้วส่งคำขอได้เลยค่ะ ช่างจะดูคิวแล้วยืนยันกลับทาง LINE' },
  ],
  promos: [
    { title: 'ทำสี แถมทรีตเมนต์', subtitle: 'จองทำสีวันอังคาร–พฤหัส ก่อน 15:00', cta: 'จองคิว' },
    { title: 'ตัดผมชาย ลด 20 บาท', subtitle: 'จองผ่าน LINE ล่วงหน้า ไม่ต้องรอหน้าร้าน', cta: 'จองคิว' },
  ],
  signage: { template: 'spotlight', theme: 'midnight' },
  seo: {
    title: 'ทดลองระบบจองคิวร้านตัดผม ซาลอน ผ่าน LINE',
    description: 'ทดลองระบบจองคิวร้านตัดผมผ่าน LINE ฟรี ไม่ต้องสมัคร ลูกค้าเลือกช่างและเวลาว่างเอง งานทำสีจองยาวได้ งานยืดผมให้ร้านยืนยันก่อน คิวไม่ชนกัน',
    h1: 'ทดลองระบบจองคิวร้านตัดผมผ่าน LINE',
    keywords: ['ระบบจองคิวร้านตัดผม', 'จองคิวร้านเสริมสวยผ่าน LINE', 'โปรแกรมจองคิวซาลอน', 'ระบบจองคิวช่างตัดผม', 'แอปจองคิวร้านทำผม'],
    answer:
      'ระบบจองคิวร้านตัดผมผ่าน LINE ให้ลูกค้าเปิด LINE OA ของร้าน เลือกบริการ เลือกช่างที่ชอบหรือไม่ระบุ แล้วเลือกเวลาที่ยังว่าง โดยไม่ต้องโหลดแอปเพิ่ม งานสั้นอย่างตัดผมชายจองตามเวลา งานยาวอย่างทำสีจองเผื่อเวลาได้ และงานยืดดัดตั้งให้ร้านกดยืนยันก่อนได้ คิวของช่างแต่ละคนจึงไม่ทับกัน',
    painPoints: [
      'ลูกค้าทักถามว่าช่างคนนี้ว่างไหม ช่างต้องวางกรรไกรมาตอบแชท',
      'งานทำสีหรือยืดผมกินเวลาเกิน คิวตัดผมถัดไปต้องรอนาน',
      'ลูกค้าจองแล้วไม่มา ช่างว่างทั้งชั่วโมง',
    ],
    benefits: [
      'ลูกค้าเลือกช่างเองใน LINE และเห็นเฉพาะช่องเวลาที่ช่างคนนั้นยังว่าง',
      'ผูกบริการกับช่างได้ ช่างที่ไม่ทำสีจะไม่ขึ้นให้เลือกตอนจองทำสี',
      'ให้ลูกค้าชำระค่าบริการผ่าน PromptPay ตอนจอง ลดการจองแล้วหาย',
      'ส่ง LINE เตือนก่อนถึงคิว และส่งข้อความขอบคุณพร้อมปุ่มรีวิว Google หลังทำผมเสร็จ',
    ],
    faqs: [
      { q: 'ระบบจองคิวร้านตัดผมให้ลูกค้าเลือกช่างเองได้ไหม', a: 'ได้ ลูกค้าเลือกช่างที่ต้องการหรือเลือก "ไม่ระบุ" ก็ได้ และร้านตั้งได้ว่าช่างแต่ละคนรับบริการไหนบ้าง เช่น ช่างที่ตัดผมชายอย่างเดียวจะไม่ขึ้นตอนลูกค้าจองทำสี' },
      { q: 'งานทำสีผมใช้เวลานาน ร้านตัดผมจะกันคิวช่างยังไงไม่ให้ชน', a: 'ตั้งระยะเวลาของบริการทำสีให้ยาวกว่าตัดผมได้ ระบบกันช่วงเวลานั้นของช่างไว้ทั้งหมด ลูกค้าคนถัดไปจะจองช่างคนนั้นได้หลังงานทำสีจบเท่านั้น' },
      { q: 'ร้านเสริมสวยให้ลูกค้าจ่ายค่าทำผมตอนจองผ่าน LINE ได้ไหม', a: 'ได้ ลูกค้าจ่ายค่าบริการผ่าน PromptPay แอปธนาคาร หรือโอนแล้วแนบสลิปตอนจอง ระบบอ่าน QR บนสลิปและเตือนเมื่อเป็นสลิปซ้ำ ถ้าไม่จ่ายตามเวลาที่ตั้งไว้ คิวจะถูกยกเลิกเอง' },
      { q: 'ร้านทำผมตั้งให้งานยืดหรือดัดต้องรอช่างยืนยันก่อนได้ไหม', a: 'ได้ ตั้งบริการนั้นเป็นแบบต้องให้ร้านอนุมัติ คิวจะขึ้นสถานะรออนุมัติ พอช่างกดยืนยัน ลูกค้าได้ข้อความแจ้งใน LINE ทันที' },
      { q: 'ลูกค้าร้านตัดผมที่หายไปนาน ระบบช่วยชวนกลับมาได้ไหม', a: 'ได้ในแพ็กเกจ Professional ขึ้นไป ระบบดูรอบที่ลูกค้าเคยมาตัดผม แล้วส่งข้อความชวนกลับทาง LINE ให้เองเมื่อเลยรอบมาแล้ว' },
    ],
    useCaseSlug: 'barber-shop',
    solutionPath: '/solutions/barbershop-booking-system',
  },
};
