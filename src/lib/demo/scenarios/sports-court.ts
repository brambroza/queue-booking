import type { BusinessScenario } from './types';

/** Badminton / tennis / futsal courts priced per court per hour. */
export const sportsCourtScenario: BusinessScenario = {
  type: 'sports_court',
  slug: 'sports-court',
  label: 'สนามกีฬา',
  icon: '🏸',
  shopName: 'สมาร์ทแบด อารีน่า',
  branchName: 'สาขารามอินทรา',
  openTime: '08:00',
  closeTime: '00:00',
  slotMinutes: 60,
  resourceLabel: 'สนาม',
  resourcePicker: 'required',
  services: [
    { key: 'badminton', name: 'จองสนามแบดมินตัน', description: 'ชั่วโมงละ 1 สนาม เลือกสนามเองได้', icon: '🏸', durationMinutes: 60, price: 0, bookingMode: 'fixed_slot', capacityPerSlot: 1 },
    { key: 'futsal', name: 'จองสนามฟุตซอล', description: 'สนามหญ้าเทียม 5 คน', icon: '⚽', durationMinutes: 60, price: 0, bookingMode: 'fixed_slot', capacityPerSlot: 1 },
    { key: 'coach', name: 'เรียนแบดกับโค้ช', description: 'คลาสตัวต่อตัว ร้านยืนยันโค้ชให้', icon: '🎯', durationMinutes: 60, price: 600, bookingMode: 'request_approval', capacityPerSlot: 1 },
  ],
  resources: [
    { code: 'C1', name: 'สนามแบด 1', type: 'court', capacity: 4, unitPrice: 180, serviceKeys: ['badminton', 'coach'], detail: 'พื้นยาง · แอร์' },
    { code: 'C2', name: 'สนามแบด 2', type: 'court', capacity: 4, unitPrice: 180, serviceKeys: ['badminton', 'coach'], detail: 'พื้นยาง · แอร์' },
    { code: 'C3', name: 'สนามแบด 3 (VIP)', type: 'court', capacity: 4, unitPrice: 240, serviceKeys: ['badminton'], detail: 'พื้นไม้ · มีที่นั่งพัก' },
    { code: 'F1', name: 'สนามฟุตซอล A', type: 'court', capacity: 10, unitPrice: 900, serviceKeys: ['futsal'], detail: 'หญ้าเทียม · ไฟส่องสว่าง' },
  ],
  queues: [
    { queueNo: 'A001', serviceKey: 'badminton', resourceCode: 'C1', time: '17:00', status: 'completed', customerName: 'คุณต้น', phone: '0810005001', payment: { method: 'omise_promptpay', status: 'paid' } },
    { queueNo: 'A002', serviceKey: 'badminton', resourceCode: 'C2', time: '18:00', status: 'serving', customerName: 'คุณแนน', phone: '0810005002', payment: { method: 'bank_transfer', status: 'paid' } },
    { queueNo: 'A003', serviceKey: 'futsal', resourceCode: 'F1', time: '18:00', status: 'called', customerName: 'ทีมบอลออฟฟิศ', phone: '0810005003', payment: { method: 'omise_promptpay', status: 'paid' } },
    { queueNo: 'A004', serviceKey: 'badminton', resourceCode: 'C3', time: '19:00', status: 'waiting', customerName: 'คุณเจ', phone: '0810005004', payment: { method: 'bank_transfer', status: 'awaiting_verification' } },
    { queueNo: 'A005', serviceKey: 'badminton', resourceCode: 'C1', time: '20:00', status: 'confirmed', customerName: 'คุณบีม', phone: '0810005005', payment: { method: 'omise_promptpay', status: 'paid' } },
    { queueNo: 'A006', serviceKey: 'coach', resourceCode: 'C2', time: '20:00', status: 'pending_approval', customerName: 'คุณพลอย', phone: '0810005006', payment: { method: 'bank_transfer', status: 'pending_payment' } },
  ],
  chats: [
    { role: 'customer', text: 'คืนนี้ 2 ทุ่มมีสนามแบดว่างไหมคะ' },
    { role: 'bot', text: 'คืนนี้ 20:00 ว่างสนามแบด 2 และสนาม VIP ค่ะ กด "จองสนาม" ที่เมนูด้านล่างได้เลย' },
    { role: 'customer', text: 'ต้องจ่ายก่อนไหม' },
    { role: 'bot', text: 'ชำระผ่าน PromptPay ตอนจองได้เลยค่ะ จ่ายแล้วคิวยืนยันทันที' },
  ],
  promos: [
    { title: 'จอง 2 ชั่วโมง ลด 10%', subtitle: 'จันทร์–ศุกร์ ก่อน 17:00', cta: 'จองสนาม' },
    { title: 'แพ็กเกจรายเดือน', subtitle: 'ล็อกสนามวันเดิม เวลาเดิม ทุกสัปดาห์', cta: 'สอบถาม' },
  ],
  signage: { template: 'timeline', theme: 'day_court' },
  seo: {
    title: 'ทดลองระบบจองสนามแบด สนามฟุตซอล ผ่าน LINE',
    description: 'ทดลองระบบจองสนามกีฬาผ่าน LINE ฟรี ไม่ต้องสมัคร ลูกค้าเลือกสนามเอง จ่าย PromptPay ก่อนลงสนาม เจ้าของเห็นตารางทุกสนามในหน้าเดียว',
    h1: 'ทดลองระบบจองสนามกีฬาผ่าน LINE',
    keywords: ['ระบบจองสนามแบด', 'ระบบจองสนามฟุตซอล', 'จองสนามผ่าน LINE', 'โปรแกรมจองสนามกีฬา', 'ระบบจองสนามออนไลน์'],
    answer:
      'ระบบจองสนามกีฬาผ่าน LINE ให้ลูกค้าเปิด LINE OA ของสนาม เลือกประเภทสนาม เลือกสนามและชั่วโมงที่ยังว่าง แล้วจ่ายผ่าน PromptPay ได้ในขั้นตอนเดียว ช่องที่ถูกจองแล้วจะขึ้นว่าเต็มทันที จึงไม่มีจองซ้อน เจ้าของสนามดูตารางทุกสนามและยอดชำระได้จากหลังบ้านเดียว',
    painPoints: [
      'ลูกค้าทักแชทถามสนามว่างทีละคน ตอบไม่ทันช่วงเย็น',
      'จองซ้อนเพราะจดในสมุดหรือกลุ่มไลน์',
      'จองแล้วไม่มา สนามว่างเสียรายได้',
    ],
    benefits: [
      'ลูกค้าเห็นสนามว่างรายชั่วโมงและเลือกสนามเองใน LINE',
      'ตั้งราคาต่อสนามได้ สนาม VIP ราคาต่างจากสนามปกติ',
      'เก็บเงินก่อนลงสนามด้วย PromptPay ลดการจองแล้วไม่มา',
      'จอทีวีหน้าสนามบอกว่าสนามไหนว่างอีกกี่นาที',
    ],
    faqs: [
      { q: 'ระบบจองสนามแบดผ่าน LINE ลูกค้าต้องโหลดแอปไหม', a: 'ไม่ต้องโหลดแอป ลูกค้ากดเมนูใน LINE OA ของสนามแล้วจองได้เลย หน้าจองเปิดในแอป LINE ที่ลูกค้ามีอยู่แล้ว' },
      { q: 'ตั้งราคาแต่ละสนามไม่เท่ากันได้ไหม', a: 'ได้ ตั้งราคาต่อสนามได้ เช่น สนามปกติ 180 บาท สนาม VIP 240 บาทต่อชั่วโมง และบังคับให้ลูกค้าเลือกสนามก่อนจองได้' },
      { q: 'ลูกค้าจองหลายชั่วโมงต่อกันได้ไหม', a: 'ได้เมื่อเปิดสวิตช์จองหลายช่อง ลูกค้าเลือกได้สูงสุด 4 ช่องในการจองครั้งเดียว และจ่ายรวมทีเดียว' },
      { q: 'กันลูกค้าจองแล้วไม่มาได้อย่างไร', a: 'ให้ลูกค้าชำระผ่าน PromptPay หรือโอนแนบสลิปตอนจอง ถ้าไม่ชำระภายในเวลาที่กำหนด ระบบยกเลิกคิวให้เอง และส่งข้อความเตือนก่อนถึงเวลาลงสนามได้' },
      { q: 'เปิดจองพร้อมกันตอนเย็น ระบบจะล่มไหม', a: 'ตั้งเวลาเปิดจองของสาขาได้ ก่อนถึงเวลาลูกค้าจะเห็นหน้านับถอยหลัง และระบบตรวจว่าสนามยังว่างอีกครั้งก่อนบันทึกทุกคิว คนที่กดช้ากว่าจะได้แจ้งให้เลือกสนามหรือเวลาอื่น' },
    ],
    solutionPath: '/solutions/badminton-court-booking-system',
  },
};
