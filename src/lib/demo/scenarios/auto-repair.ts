import type { BusinessScenario } from './types';

/** Car service centre: maintenance by fixed time, bigger repairs confirmed by the shop, priced per job. */
export const autoRepairScenario: BusinessScenario = {
  type: 'auto_repair',
  slug: 'auto-repair',
  label: 'ศูนย์ซ่อมรถยนต์',
  icon: '🚗',
  shopName: 'ช.ทวีชัย ออโต้เซอร์วิส',
  branchName: 'สาขาบางนา-ตราด',
  openTime: '08:00',
  closeTime: '18:00',
  slotMinutes: 30,
  resourceLabel: 'ช่องซ่อม',
  resourcePicker: 'optional',
  services: [
    { key: 'oil-change', name: 'เปลี่ยนถ่ายน้ำมันเครื่อง', description: 'น้ำมันกึ่งสังเคราะห์ 4 ลิตร พร้อมกรองน้ำมัน', icon: '🛢️', durationMinutes: 45, price: 1290, bookingMode: 'fixed_slot', capacityPerSlot: 2 },
    { key: 'periodic-check', name: 'เช็คระยะตามไมล์', description: 'ตรวจ 30 รายการ เบรก ช่วงล่าง ของเหลว แบตเตอรี่', icon: '🔧', durationMinutes: 120, price: 1890, bookingMode: 'fixed_slot', capacityPerSlot: 1 },
    { key: 'tyre-align', name: 'เปลี่ยนยาง + ตั้งศูนย์ถ่วงล้อ', description: 'นำยางมาเองหรือเลือกยางที่ร้านก็ได้', icon: '🛞', durationMinutes: 60, price: 600, bookingMode: 'fixed_slot', capacityPerSlot: 1 },
    { key: 'aircon-repair', name: 'ตรวจเช็คแอร์รถยนต์', description: 'แอร์ไม่เย็น มีกลิ่น ช่างดูอาการแล้วยืนยันคิวซ่อม', icon: '❄️', durationMinutes: 90, price: 0, bookingMode: 'request_approval', capacityPerSlot: 1 },
    { key: 'engine-repair', name: 'ซ่อมเครื่องยนต์ / ช่วงล่าง', description: 'งานใหญ่ ร้านโทรประเมินราคาก่อนรับรถ', icon: '⚙️', durationMinutes: 240, price: 0, bookingMode: 'request_approval', capacityPerSlot: 1 },
  ],
  resources: [
    { code: 'BAY1', name: 'ช่องยก 1', type: 'service_area', capacity: 1, serviceKeys: ['oil-change', 'periodic-check', 'engine-repair'], detail: 'ลิฟต์ยก 4 เสา · รถเก๋ง/กระบะ' },
    { code: 'BAY2', name: 'ช่องยก 2', type: 'service_area', capacity: 1, serviceKeys: ['oil-change', 'periodic-check', 'aircon-repair'], detail: 'ลิฟต์ยก 2 เสา · มีเครื่องเติมน้ำยาแอร์' },
    { code: 'TYRE', name: 'ช่องยางและศูนย์ล้อ', type: 'service_area', capacity: 1, serviceKeys: ['tyre-align'], detail: 'เครื่องตั้งศูนย์ 3D' },
  ],
  queues: [
    { queueNo: 'A001', serviceKey: 'oil-change', resourceCode: 'BAY1', time: '08:30', status: 'completed', customerName: 'คุณวิชัย', nickname: 'กข 4521', phone: '0810007001', payment: { method: 'omise_promptpay', status: 'paid' } },
    { queueNo: 'A002', serviceKey: 'periodic-check', resourceCode: 'BAY2', time: '09:00', status: 'serving', customerName: 'คุณสุนิสา', nickname: '3กท 882', phone: '0810007002', payment: { method: 'bank_transfer', status: 'paid' } },
    { queueNo: 'A003', serviceKey: 'tyre-align', resourceCode: 'TYRE', time: '10:00', status: 'called', customerName: 'คุณอนันต์', nickname: 'ฒล 1199', phone: '0810007003' },
    { queueNo: 'A004', serviceKey: 'oil-change', resourceCode: 'BAY1', time: '10:30', status: 'waiting', customerName: 'คุณเก่ง', nickname: '1ขจ 7310', phone: '0810007004', payment: { method: 'omise_mobile_banking', status: 'paid' } },
    { queueNo: 'A005', serviceKey: 'oil-change', time: '11:00', status: 'checked_in', customerName: 'คุณแพร', nickname: 'งษ 640', phone: '0810007005' },
    { queueNo: 'A006', serviceKey: 'aircon-repair', resourceCode: 'BAY2', time: '13:00', status: 'pending_approval', customerName: 'คุณประเสริฐ', nickname: 'บง 2287', phone: '0810007006' },
    { queueNo: 'A007', serviceKey: 'engine-repair', resourceCode: 'BAY1', time: '13:30', status: 'confirmed', customerName: 'คุณธนา', nickname: '5กร 3056', phone: '0810007007' },
  ],
  chats: [
    { role: 'customer', text: 'พรุ่งนี้เช้าเอารถเข้าเช็คระยะ 40,000 กม. ได้ไหมครับ' },
    { role: 'bot', text: 'พรุ่งนี้ยังว่าง 08:00 และ 10:00 ค่ะ กด "จองคิวซ่อม" ที่เมนูด้านล่าง เลือกเช็คระยะตามไมล์ได้เลย' },
    { role: 'customer', text: 'ต้องรอที่ร้านนานไหม' },
    { role: 'bot', text: 'เช็คระยะใช้เวลาประมาณ 2 ชั่วโมงค่ะ ระหว่างรอมีห้องรับรองพร้อมไวไฟ ถ้าช่างเรียกคิวแล้วจะมีข้อความแจ้งใน LINE' },
  ],
  promos: [
    { title: 'เปลี่ยนน้ำมันเครื่อง ฟรีเช็คแบต', subtitle: 'จองผ่าน LINE จันทร์–พฤหัส', cta: 'จองคิวซ่อม' },
    { title: 'ตรวจเช็คแอร์ก่อนหน้าร้อน', subtitle: 'ช่างดูอาการก่อน แจ้งราคาก่อนซ่อมทุกครั้ง', cta: 'นัดตรวจแอร์' },
  ],
  signage: { template: 'board', theme: 'day_navy' },
  seo: {
    title: 'ทดลองระบบจองคิวอู่ซ่อมรถ ศูนย์บริการรถยนต์ ผ่าน LINE',
    description: 'ทดลองระบบจองคิวซ่อมรถผ่าน LINE ฟรี ไม่ต้องสมัคร ลูกค้านัดเช็คระยะ เปลี่ยนน้ำมันเครื่องเองได้ งานใหญ่ร้านยืนยันก่อน เห็นคิวทุกช่องยกในหน้าเดียว',
    h1: 'ทดลองระบบจองคิวศูนย์ซ่อมรถยนต์ผ่าน LINE',
    keywords: ['ระบบจองคิวอู่ซ่อมรถ', 'จองคิวเช็คระยะรถยนต์', 'โปรแกรมจองคิวศูนย์บริการรถยนต์', 'นัดซ่อมรถผ่าน LINE', 'ระบบนัดหมายอู่รถ'],
    answer:
      'ระบบจองคิวอู่ซ่อมรถผ่าน LINE ให้ลูกค้านัดเปลี่ยนน้ำมันเครื่อง เช็คระยะ หรือเปลี่ยนยางได้เองจาก LINE OA ของร้าน โดยเห็นเฉพาะเวลาที่ช่องยกยังว่าง งานซ่อมใหญ่ที่ต้องประเมินก่อนตั้งให้ร้านกดยืนยันได้ อู่จึงรู้ล่วงหน้าว่าแต่ละวันมีรถเข้ากี่คันและเข้าช่องไหน',
    painPoints: [
      'รถมาพร้อมกันตอนเช้า ช่องยกไม่พอ ลูกค้ารอนานจนบ่น',
      'โทรนัดแล้วจดลืม ลูกค้ามาถึงแต่ไม่มีชื่อในคิว',
      'นัดเช็คระยะแล้วไม่มา ช่างว่างทั้งช่วงเช้า',
    ],
    benefits: [
      'ลูกค้าเลือกบริการและเวลาที่ช่องยกว่างได้เองใน LINE',
      'งานซ่อมใหญ่ตั้งให้ร้านยืนยันก่อน ไม่รับงานเกินกำลังช่าง',
      'งานราคาตายตัวเก็บเงินตอนจองผ่าน PromptPay / แอปธนาคาร / โอนแนบสลิป ไม่จ่ายตามกำหนดระบบยกเลิกคิวให้',
      'ส่ง LINE เตือนก่อนนัด และแจ้งเมื่อช่างเรียกคิวรับรถ',
    ],
    faqs: [
      { q: 'ระบบจองคิวอู่ซ่อมรถ แยกคิวตามช่องยกได้ไหม', a: 'ได้ ตั้งช่องยกหรือช่องเปลี่ยนยางเป็นพื้นที่บริการ แล้วผูกว่าช่องไหนรับงานอะไร ลูกค้าเลือกช่องเองหรือเลือก "ไม่ระบุ" ก็ได้ และช่องที่มีรถจองแล้วจะไม่เปิดให้จองซ้อน' },
      { q: 'งานซ่อมรถที่ต้องประเมินราคาก่อน ให้ลูกค้าจองผ่าน LINE ได้ไหม', a: 'ได้ ตั้งบริการนั้นเป็นแบบร้านต้องยืนยันก่อน คิวจะขึ้นสถานะรออนุมัติ ช่างโทรประเมินแล้วค่อยกดยืนยัน ลูกค้าได้ข้อความยืนยันคิวใน LINE' },
      { q: 'อู่ซ่อมรถเก็บค่าเปลี่ยนน้ำมันเครื่องตอนลูกค้านัดได้ไหม', a: 'ได้ บริการที่ตั้งราคาไว้ ลูกค้าจ่ายเต็มจำนวนตอนจองผ่าน PromptPay แอปธนาคาร หรือโอนแล้วแนบสลิป ระบบอ่าน QR บนสลิปและเตือนเมื่อสลิปซ้ำ ถ้าไม่จ่ายภายในเวลาที่กำหนด คิวถูกยกเลิกให้เอง ส่วนงานซ่อมที่ยังไม่รู้ราคาตั้งราคา 0 ไว้ ลูกค้าจ่ายที่อู่' },
      { q: 'งานซ่อมรถเกินเวลาที่นัดไว้ ทำอย่างไรกับคิวถัดไป', a: 'พนักงานกดต่อเวลาให้คิวที่ผูกกับช่องยกได้ ระบบเช็คก่อนว่าช่องนั้นช่วงถัดไปว่าง คิวหลังจึงไม่ทับกัน' },
      { q: 'จอทีวีในห้องรับรองลูกค้าอู่รถ แสดงทะเบียนรถได้ไหม', a: 'ได้ จอคิวเปิดจากเบราว์เซอร์ของทีวีเครื่องไหนก็ได้ ถ้าลูกค้าใส่ชื่อเล่นเป็นเลขทะเบียน จอจะแสดงทะเบียนนั้น คนนั่งรอจึงเห็นว่ารถคันไหนกำลังซ่อมและคันไหนถูกเรียกรับรถ' },
    ],
    useCaseSlug: 'car-service',
  },
};
