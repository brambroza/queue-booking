import type { BusinessScenario } from './types';

/** Aesthetic clinic: doctor consults, laser rooms, injectables confirmed by the clinic paid online when booking. */
export const beautyClinicScenario: BusinessScenario = {
  type: 'beauty_clinic',
  slug: 'beauty-clinic',
  label: 'คลินิกความงาม',
  icon: '✨',
  shopName: 'ผิวใสใจดี คลินิกเวชกรรม',
  branchName: 'สาขาอารีย์',
  openTime: '11:00',
  closeTime: '20:00',
  slotMinutes: 30,
  resourceLabel: 'แพทย์',
  resourcePicker: 'optional',
  services: [
    { key: 'consult', name: 'ปรึกษาแพทย์ผิวหนัง', description: 'ประเมินสภาพผิว วางแผนการรักษา ไม่มีค่าใช้จ่าย', icon: '🩺', durationMinutes: 30, price: 0, bookingMode: 'fixed_slot', capacityPerSlot: 1 },
    { key: 'laser', name: 'เลเซอร์หน้าใส', description: 'ลดรอยดำ ฝ้า กระ ทำเสร็จกลับบ้านได้เลย', icon: '💡', durationMinutes: 45, price: 2500, bookingMode: 'fixed_slot', capacityPerSlot: 1 },
    { key: 'facial', name: 'ทรีตเมนต์หน้า + มาสก์', description: 'ทำความสะอาดผิว กดสิว มาสก์เย็น', icon: '🧖', durationMinutes: 60, price: 1290, bookingMode: 'fixed_slot', capacityPerSlot: 2 },
    { key: 'inject', name: 'ค่าจองคิวพบแพทย์ (โบท็อกซ์/ฟิลเลอร์)', description: 'ค่าจองคิว 500 บาท ค่าหัตถการแพทย์แจ้งราคาและชำระที่คลินิก คลินิกยืนยันเวลาให้', icon: '💉', durationMinutes: 60, price: 500, bookingMode: 'request_approval', capacityPerSlot: 1 },
  ],
  resources: [
    { code: 'DR-EARN', name: 'พญ.เอิร์น', type: 'trainer', capacity: 1, serviceKeys: ['consult', 'inject', 'laser'], detail: 'แพทย์ผิวหนัง ฟิลเลอร์ ปรับรูปหน้า' },
    { code: 'DR-GIFT', name: 'พญ.กิ๊ฟ', type: 'trainer', capacity: 1, serviceKeys: ['consult', 'laser'], detail: 'เลเซอร์ ฝ้า กระ รอยสิว' },
    { code: 'ROOM-F', name: 'ห้องทรีตเมนต์ 1', type: 'service_area', capacity: 1, serviceKeys: ['facial'], detail: 'เตียงเดี่ยว ห้องปิดส่วนตัว' },
  ],
  queues: [
    { queueNo: 'A001', serviceKey: 'consult', resourceCode: 'DR-GIFT', time: '11:30', status: 'completed', customerName: 'คุณพิม', phone: '0850004001' },
    { queueNo: 'A002', serviceKey: 'laser', resourceCode: 'DR-GIFT', time: '13:00', status: 'serving', customerName: 'คุณแก้ว', phone: '0850004002', payment: { method: 'omise_promptpay', status: 'paid' } },
    { queueNo: 'A003', serviceKey: 'facial', resourceCode: 'ROOM-F', time: '13:30', status: 'called', customerName: 'คุณนุ่น', phone: '0850004003', payment: { method: 'omise_mobile_banking', status: 'paid' } },
    { queueNo: 'A004', serviceKey: 'consult', resourceCode: 'DR-EARN', time: '14:00', status: 'waiting', customerName: 'คุณเบลล์', phone: '0850004004' },
    { queueNo: 'A005', serviceKey: 'laser', time: '15:30', status: 'checked_in', customerName: 'คุณออม', phone: '0850004005', payment: { method: 'bank_transfer', status: 'paid' } },
    { queueNo: 'A006', serviceKey: 'inject', resourceCode: 'DR-EARN', time: '17:00', status: 'pending_approval', customerName: 'คุณกวาง', phone: '0850004006', payment: { method: 'bank_transfer', status: 'awaiting_verification' } },
  ],
  chats: [
    { role: 'customer', text: 'อยากปรึกษาเรื่องฝ้าก่อน ยังไม่แน่ใจว่าจะทำเลเซอร์ไหมคะ' },
    { role: 'bot', text: 'จองบริการ "ปรึกษาแพทย์ผิวหนัง" ได้เลยค่ะ ไม่มีค่าใช้จ่าย แพทย์จะประเมินผิวแล้วแนะนำให้ที่คลินิก' },
    { role: 'customer', text: 'จองคิวฟิลเลอร์ต้องจ่ายเงินก่อนไหม' },
    { role: 'bot', text: 'ชำระค่าจองคิว 500 บาทผ่าน PromptPay ตอนจองค่ะ ค่าหัตถการแพทย์แจ้งและชำระที่คลินิก คลินิกจะยืนยันเวลาแล้วแจ้งกลับทาง LINE' },
  ],
  promos: [
    { title: 'เลเซอร์หน้าใส 3 ครั้ง', subtitle: 'จองครั้งแรกผ่าน LINE ได้ราคาคอร์ส', cta: 'จองเลเซอร์' },
    { title: 'ปรึกษาแพทย์ฟรี', subtitle: 'ทุกวัน 11:00–14:00 ไม่ต้องซื้อคอร์ส', cta: 'จองปรึกษา' },
  ],
  signage: { template: 'spotlight', theme: 'day_rose' },
  seo: {
    title: 'ทดลองระบบจองคิวคลินิกความงามผ่าน LINE',
    description: 'ทดลองระบบจองคิวคลินิกความงามผ่าน LINE ฟรี ไม่ต้องสมัคร ลูกค้าเลือกแพทย์และเวลาว่างเอง ชำระผ่าน PromptPay ตอนจอง งานฟิลเลอร์ให้คลินิกยืนยันก่อน',
    h1: 'ทดลองระบบจองคิวคลินิกความงามผ่าน LINE',
    keywords: ['ระบบจองคิวคลินิกความงาม', 'ระบบนัดหมายคลินิกเสริมความงาม', 'จองคิวเลเซอร์ผ่าน LINE', 'โปรแกรมจองคิวคลินิกผิวหนัง', 'ระบบจองคิวคลินิกทันตกรรม'],
    answer:
      'ระบบจองคิวคลินิกความงามผ่าน LINE ให้ลูกค้าเลือกบริการ เช่น ปรึกษาแพทย์ เลเซอร์ หรือทรีตเมนต์ เลือกแพทย์หรือไม่ระบุ แล้วเลือกเวลาที่ยังว่างใน LINE OA ของคลินิก ลูกค้าชำระค่าบริการผ่าน PromptPay ได้ตอนจอง และงานหัตถการอย่างโบท็อกซ์หรือฟิลเลอร์ตั้งให้คลินิกยืนยันกับแพทย์ก่อนได้',
    painPoints: [
      'แอดมินตอบแชทถามคิวแพทย์ทั้งวัน ลูกค้าที่รอนานก็ไปคลินิกอื่น',
      'ลูกค้านัดเลเซอร์แล้วไม่มา ห้องและแพทย์ว่างทั้งช่วง',
      'ตารางแพทย์หลายคนจดแยกกัน นัดซ้อนกันบ่อยในวันหยุด',
    ],
    benefits: [
      'ลูกค้าเห็นเวลาว่างของแพทย์แต่ละคนและจองเองใน LINE ไม่ต้องรอแอดมินตอบ',
      'เก็บค่าบริการผ่าน PromptPay หรือโอนแนบสลิปตอนจอง ไม่จ่ายตามกำหนดระบบยกเลิกคิวให้',
      'หัตถการที่ต้องพบแพทย์ตั้งให้คลินิกยืนยันก่อน ลูกค้าได้ข้อความแจ้งใน LINE',
      'ซิงก์คิวเข้า Google Calendar ของคลินิก แพทย์เปิดดูตารางจากมือถือได้',
    ],
    faqs: [
      { q: 'คลินิกความงามให้ลูกค้าจ่ายค่าเลเซอร์ก่อนมาถึงคลินิกได้ไหม', a: 'ได้ ตั้งให้ลูกค้าจ่ายค่าบริการผ่าน PromptPay แอปธนาคาร หรือโอนแนบสลิปตอนจอง ระบบอ่าน QR บนสลิปและเตือนสลิปซ้ำ ถ้าไม่จ่ายตามเวลาที่ตั้งไว้ คิวจะถูกยกเลิกเอง' },
      { q: 'คลินิกความงามตั้งให้งานฟิลเลอร์ต้องรอแพทย์ยืนยันก่อนได้ไหม', a: 'ได้ ตั้งบริการนั้นเป็นแบบต้องให้คลินิกอนุมัติ คิวจะขึ้นสถานะรออนุมัติจนกว่าเจ้าหน้าที่จะกดยืนยัน แล้วลูกค้าจะได้ข้อความแจ้งใน LINE' },
      { q: 'ลูกค้าคลินิกความงามเลือกแพทย์ที่ต้องการตอนจองได้ไหม', a: 'ได้ ลูกค้าเลือกแพทย์หรือเลือก "ไม่ระบุ" ก็ได้ และคลินิกผูกได้ว่าแพทย์คนไหนทำบริการอะไร ลูกค้าจึงเห็นเฉพาะแพทย์ที่ทำบริการนั้นได้' },
      { q: 'คลินิกความงามมีหลายสาขา ใช้ระบบจองคิวเดียวกันได้ไหม', a: 'ได้ เพิ่มสาขาได้หลายแห่ง ลูกค้าเลือกสาขาตอนจอง แต่ละสาขามีเวลาทำการ แพทย์ และห้องของตัวเอง และกำหนดสิทธิ์พนักงานแยกตามสาขาได้' },
      { q: 'คลินิกความงามส่งข้อความหลังทำเสร็จให้ลูกค้ารีวิว Google ได้ไหม', a: 'ได้ เปิดข้อความขอบคุณหลังจบบริการ ระบบส่งทาง LINE พร้อมปุ่มไปหน้ารีวิว Google ของคลินิกตามเวลาที่ตั้งไว้' },
    ],
  },
};
