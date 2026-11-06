import type { BusinessScenario } from './types';

/** Accounting / tax advisory office: paid 1:1 appointments with a chosen advisor, larger jobs confirmed first. */
export const consultScenario: BusinessScenario = {
  type: 'consult',
  slug: 'consultation',
  label: 'ที่ปรึกษา',
  icon: '💼',
  shopName: 'สำนักงานบัญชีธนพร แอนด์ แอดไวเซอรี่',
  branchName: 'สำนักงานใหญ่ งามวงศ์วาน',
  openTime: '09:00',
  closeTime: '18:00',
  slotMinutes: 30,
  resourceLabel: 'ที่ปรึกษา',
  resourcePicker: 'optional',
  services: [
    { key: 'tax', name: 'ปรึกษาภาษีบุคคล / ยื่น ภ.ง.ด.90', description: '30 นาที นำเอกสารรายได้มาด้วย', icon: '🧮', durationMinutes: 30, price: 500, bookingMode: 'fixed_slot', capacityPerSlot: 1 },
    { key: 'online-shop', name: 'ปรึกษาภาษีร้านค้าออนไลน์ / VAT', description: '1 ชั่วโมง วางแผนจดทะเบียนและภาษี', icon: '🛒', durationMinutes: 60, price: 1200, bookingMode: 'fixed_slot', capacityPerSlot: 1 },
    { key: 'company-setup', name: 'จดทะเบียนบริษัท / ห้างหุ้นส่วน', description: 'นัดคุยรายละเอียด สำนักงานยืนยันวันให้', icon: '🏛️', durationMinutes: 90, price: 2000, bookingMode: 'request_approval', capacityPerSlot: 1 },
    { key: 'review', name: 'ตรวจงบ / ปิดบัญชีปลายปี', description: 'ใช้เวลาตามขนาดกิจการ นัดได้หลายชั่วโมง', icon: '📑', durationMinutes: 60, price: 1500, bookingMode: 'flexible_duration', capacityPerSlot: 1 },
  ],
  resources: [
    { code: 'CPA-TP', name: 'คุณธนพร (CPA)', type: 'trainer', capacity: 1, serviceKeys: ['company-setup', 'review', 'online-shop'], detail: 'ผู้สอบบัญชีรับอนุญาต' },
    { code: 'TAX-WIT', name: 'คุณวิทย์', type: 'trainer', capacity: 1, serviceKeys: ['tax', 'online-shop'], detail: 'ที่ปรึกษาภาษี · อดีตเจ้าหน้าที่สรรพากร' },
    { code: 'ACC-GIFT', name: 'คุณกิ๊ฟ', type: 'trainer', capacity: 1, serviceKeys: ['tax', 'review'], detail: 'นักบัญชี · ดูแลร้านค้ารายย่อย' },
  ],
  queues: [
    { queueNo: 'A001', serviceKey: 'tax', resourceCode: 'TAX-WIT', time: '09:30', status: 'completed', customerName: 'คุณสุนิสา', phone: '0880012001', payment: { method: 'omise_promptpay', status: 'paid' } },
    { queueNo: 'A002', serviceKey: 'review', resourceCode: 'CPA-TP', time: '10:00', status: 'serving', customerName: 'หจก.เจริญยนต์', phone: '0880012002', payment: { method: 'bank_transfer', status: 'paid' } },
    { queueNo: 'A003', serviceKey: 'tax', resourceCode: 'ACC-GIFT', time: '10:30', status: 'called', customerName: 'คุณภาคิน', phone: '0880012003', payment: { method: 'omise_promptpay', status: 'paid' } },
    { queueNo: 'A004', serviceKey: 'online-shop', resourceCode: 'TAX-WIT', time: '11:00', status: 'waiting', customerName: 'คุณเมย์ (ร้านเครื่องสำอางออนไลน์)', phone: '0880012004', payment: { method: 'omise_mobile_banking', status: 'paid' } },
    { queueNo: 'A005', serviceKey: 'tax', time: '13:30', status: 'confirmed', customerName: 'คุณชัยวัฒน์', phone: '0880012005', payment: { method: 'bank_transfer', status: 'awaiting_verification' } },
    { queueNo: 'A006', serviceKey: 'company-setup', resourceCode: 'CPA-TP', time: '14:00', status: 'pending_approval', customerName: 'คุณอาร์ม (เปิดบริษัทใหม่)', phone: '0880012006', payment: { method: 'bank_transfer', status: 'pending_payment' } },
  ],
  chats: [
    { role: 'customer', text: 'ขายของออนไลน์ยอดเกิน 1.8 ล้าน ต้องจด VAT ไหมครับ อยากนัดคุย' },
    { role: 'bot', text: 'นัดปรึกษาภาษีร้านค้าออนไลน์ได้เลยครับ 1 ชั่วโมง 1,200 บาท กด "นัดปรึกษา" เลือกที่ปรึกษาและเวลาที่ว่างได้ครับ' },
    { role: 'customer', text: 'ต้องเตรียมอะไรไปบ้าง' },
    { role: 'bot', text: 'เตรียมสรุปยอดขายรายเดือนและรายการค่าใช้จ่ายมาด้วยครับ ระบบจะส่งข้อความเตือนก่อนถึงเวลานัด 1 วัน' },
  ],
  promos: [
    { title: 'ช่วงยื่นภาษี ปรึกษา 30 นาที 390 บาท', subtitle: 'มกราคม–มีนาคม เฉพาะนัดผ่าน LINE', cta: 'นัดปรึกษา' },
    { title: 'จดบริษัท ฟรีที่ปรึกษาบัญชี 3 เดือน', subtitle: 'สำหรับลูกค้าจดทะเบียนกับสำนักงาน', cta: 'สอบถาม' },
  ],
  signage: { template: 'minimal', theme: 'day_navy' },
  seo: {
    title: 'ทดลองระบบนัดหมายที่ปรึกษา สำนักงานบัญชี ผ่าน LINE',
    description: 'ทดลองระบบนัดหมายที่ปรึกษาผ่าน LINE ฟรี ไม่ต้องสมัคร ลูกค้าเลือกหัวข้อ ที่ปรึกษา และเวลาที่ว่าง จ่ายค่าปรึกษาตอนนัด เตือนก่อนถึงนัดทางไลน์ให้อัตโนมัติ',
    h1: 'ทดลองระบบนัดหมายที่ปรึกษาผ่าน LINE',
    keywords: ['ระบบนัดหมายที่ปรึกษา', 'ระบบนัดหมายลูกค้าผ่าน LINE', 'ระบบนัดปรึกษาสำนักงานบัญชี', 'โปรแกรมนัดหมายออนไลน์', 'จองคิวปรึกษาภาษี'],
    answer:
      'ระบบนัดหมายที่ปรึกษาผ่าน LINE ให้ลูกค้าเลือกหัวข้อที่ต้องการปรึกษา เลือกที่ปรึกษาและเวลาที่ยังว่างจาก LINE OA ของสำนักงาน แล้วชำระค่าปรึกษาตอนนัด ระบบส่งข้อความเตือนก่อนถึงเวลา งานที่ต้องเตรียมตัวก่อนอย่างจดทะเบียนบริษัทตั้งให้สำนักงานยืนยันวันนัดก่อนได้',
    painPoints: [
      'นัดผ่านแชทไปมาหลายรอบกว่าจะได้เวลาที่ตรงกัน',
      'ลูกค้านัดแล้วไม่มา ที่ปรึกษาเสียเวลาทั้งช่วง',
      'ตารางที่ปรึกษาแต่ละคนอยู่คนละที่ นัดซ้อนกันบ่อย',
    ],
    benefits: [
      'ผูกที่ปรึกษากับหัวข้อที่ถนัด ลูกค้าเลือกได้เฉพาะคนที่รับหัวข้อนั้น',
      'เก็บค่าปรึกษาเต็มจำนวนตอนนัดผ่าน PromptPay / แอปธนาคาร / โอนแนบสลิป ไม่ชำระตามกำหนดระบบยกเลิกนัดให้',
      'ส่งข้อความเตือนก่อนนัดตั้งแต่ 15 นาทีถึง 1 วัน',
      'ซิงก์นัดเข้า Google Calendar ของสำนักงาน',
    ],
    faqs: [
      { q: 'ระบบนัดหมายที่ปรึกษาผ่าน LINE ให้ลูกค้าเลือกที่ปรึกษาเองได้ไหม', a: 'ได้ เพิ่มที่ปรึกษาแต่ละคนแล้วผูกกับหัวข้อที่รับ ลูกค้าเลือกคนและเวลาที่ว่างเองได้ หรือเลือก "ไม่ระบุ" ให้สำนักงานจัดคนให้' },
      { q: 'สำนักงานบัญชีเก็บค่าปรึกษาล่วงหน้าตอนลูกค้านัดได้ไหม', a: 'ได้ ลูกค้าชำระผ่าน PromptPay แอปธนาคาร หรือโอนแนบสลิปตอนนัด ระบบอ่าน QR บนสลิปและเตือนสลิปซ้ำ ถ้าไม่ชำระภายในเวลาที่กำหนดนัดจะถูกยกเลิกเอง' },
      { q: 'นัดปรึกษาจดทะเบียนบริษัทให้สำนักงานยืนยันวันก่อนได้ไหม', a: 'ได้ ตั้งบริการนั้นให้ต้องรอยืนยัน นัดจะอยู่ในสถานะรออนุมัติจนสำนักงานตรวจเอกสารเบื้องต้นแล้วกดยืนยัน ลูกค้าได้ข้อความยืนยันใน LINE' },
      { q: 'นัดหมายที่ปรึกษาผ่าน LINE ซิงก์เข้า Google Calendar ได้ไหม', a: 'ได้ เชื่อม Google Calendar แล้วนัดใหม่ นัดที่ย้าย และนัดที่ยกเลิกจะอัปเดตในปฏิทินให้ ที่ปรึกษาเห็นตารางของตัวเองจากปฏิทินที่ใช้อยู่แล้ว' },
      { q: 'ที่ปรึกษาจำกัดไม่ให้ลูกค้านัดล่วงหน้าไกลเกินไปได้ไหม', a: 'ได้ ตั้งระยะจองล่วงหน้าได้ เช่น 2 สัปดาห์หรือ 1 เดือน หรือกำหนดวันสุดท้ายที่รับนัด ลูกค้าจะเห็นเฉพาะวันที่อยู่ในช่วงนั้นในปฏิทิน' },
    ],
    useCaseSlug: 'consulting',
  },
};
