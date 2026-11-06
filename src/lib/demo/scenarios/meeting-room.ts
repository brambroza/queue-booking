import type { BusinessScenario } from './types';

/** Co-working space renting meeting rooms by the hour, each room priced on its own. */
export const meetingRoomScenario: BusinessScenario = {
  type: 'meeting_room',
  slug: 'meeting-room',
  label: 'ห้องประชุม',
  icon: '🏢',
  shopName: 'ไอเดียบ็อกซ์ โคเวิร์กกิ้ง',
  branchName: 'สาขาอารีย์',
  openTime: '08:00',
  closeTime: '21:00',
  slotMinutes: 60,
  resourceLabel: 'ห้อง',
  resourcePicker: 'required',
  services: [
    { key: 'hourly', name: 'จองห้องประชุมรายชั่วโมง', description: 'ราคาตามห้อง รวมจอและไวไฟ', icon: '🗓️', durationMinutes: 60, price: 0, bookingMode: 'fixed_slot', capacityPerSlot: 1 },
    { key: 'long-session', name: 'จองห้องต่อเนื่องหลายชั่วโมง', description: 'ประชุมยาว ต่อเวลาได้ถ้าห้องยังว่าง', icon: '⏱️', durationMinutes: 60, price: 0, bookingMode: 'flexible_duration', capacityPerSlot: 1 },
    { key: 'training', name: 'ห้องอบรม ครึ่งวัน', description: '4 ชั่วโมง ร้านยืนยันการจัดโต๊ะให้', icon: '🎤', durationMinutes: 240, price: 0, bookingMode: 'request_approval', capacityPerSlot: 1 },
  ],
  resources: [
    { code: 'R-FOCUS', name: 'ห้องโฟกัส', type: 'meeting_room', capacity: 4, unitPrice: 250, serviceKeys: ['hourly', 'long-session'], detail: '4 ที่นั่ง · จอ 43 นิ้ว' },
    { code: 'R-TEAM', name: 'ห้องทีม', type: 'meeting_room', capacity: 8, unitPrice: 450, serviceKeys: ['hourly', 'long-session'], detail: '8 ที่นั่ง · จอ 65 นิ้ว · ไวท์บอร์ด' },
    { code: 'R-BOARD', name: 'ห้องบอร์ดรูม', type: 'meeting_room', capacity: 14, unitPrice: 800, serviceKeys: ['hourly', 'long-session'], detail: '14 ที่นั่ง · กล้องประชุมออนไลน์' },
    { code: 'R-HALL', name: 'ห้องอบรมใหญ่', type: 'meeting_room', capacity: 40, unitPrice: 3500, serviceKeys: ['training'], detail: 'จัดได้ 40 ที่นั่ง · ไมค์ลอย 2 ตัว' },
  ],
  queues: [
    { queueNo: 'A001', serviceKey: 'hourly', resourceCode: 'R-FOCUS', time: '09:00', status: 'completed', customerName: 'คุณปิง (ฟรีแลนซ์)', phone: '0840008001', payment: { method: 'omise_promptpay', status: 'paid' } },
    { queueNo: 'A002', serviceKey: 'long-session', resourceCode: 'R-BOARD', time: '10:00', status: 'serving', customerName: 'บจก.สยามเทรดดิ้ง', phone: '0840008002', payment: { method: 'bank_transfer', status: 'paid' } },
    { queueNo: 'A003', serviceKey: 'hourly', resourceCode: 'R-TEAM', time: '11:00', status: 'called', customerName: 'คุณเบนซ์', phone: '0840008003', payment: { method: 'omise_mobile_banking', status: 'paid' } },
    { queueNo: 'A004', serviceKey: 'hourly', resourceCode: 'R-FOCUS', time: '11:00', status: 'waiting', customerName: 'คุณออม', phone: '0840008004', payment: { method: 'omise_promptpay', status: 'paid' } },
    { queueNo: 'A005', serviceKey: 'hourly', resourceCode: 'R-TEAM', time: '14:00', status: 'confirmed', customerName: 'ทีมสตาร์ทอัพ คิวบิก', phone: '0840008005', payment: { method: 'bank_transfer', status: 'awaiting_verification' } },
    { queueNo: 'A006', serviceKey: 'training', resourceCode: 'R-HALL', time: '13:00', status: 'pending_approval', customerName: 'ฝ่ายบุคคล บจก.ไทยพัฒนา', phone: '0840008006', payment: { method: 'bank_transfer', status: 'pending_payment' } },
  ],
  chats: [
    { role: 'customer', text: 'พรุ่งนี้บ่ายมีห้องประชุม 6 คนว่างไหมคะ' },
    { role: 'bot', text: 'พรุ่งนี้ 13:00–16:00 ห้องทีม (8 ที่นั่ง) ยังว่างค่ะ ชั่วโมงละ 450 บาท กด "จองห้อง" ดูรูปห้องและเลือกเวลาได้เลย' },
    { role: 'customer', text: 'ขอใบกำกับภาษีได้ไหม' },
    { role: 'bot', text: 'ได้ค่ะ แจ้งชื่อบริษัทและเลขผู้เสียภาษีในแชทนี้ เจ้าหน้าที่ออกให้หลังใช้ห้องค่ะ' },
  ],
  promos: [
    { title: 'จอง 3 ชั่วโมง ฟรี 1 ชั่วโมง', subtitle: 'ห้องโฟกัสและห้องทีม ช่วง 8:00–12:00', cta: 'จองห้อง' },
    { title: 'ห้องอบรมพร้อมคอฟฟี่เบรก', subtitle: 'แพ็กเกจครึ่งวัน 30 ท่าน สอบถามราคาในแชท', cta: 'ขอใบเสนอราคา' },
  ],
  signage: { template: 'board', theme: 'meeting' },
  seo: {
    title: 'ทดลองระบบจองห้องประชุมผ่าน LINE คิดราคาตามห้อง',
    description: 'ทดลองระบบจองห้องประชุมผ่าน LINE ฟรี ไม่ต้องสมัคร ลูกค้าดูรูปห้อง เลือกห้องและชั่วโมงที่ว่าง จ่ายผ่าน PromptPay ห้องที่ถูกจองขึ้นว่าเต็มทันที ไม่มีจองซ้อน',
    h1: 'ทดลองระบบจองห้องประชุมผ่าน LINE',
    keywords: ['ระบบจองห้องประชุม', 'จองห้องประชุมผ่าน LINE', 'โปรแกรมจองห้องประชุม', 'ระบบจองห้องประชุมออนไลน์', 'จองห้องประชุม co-working', 'เช่าห้องประชุมรายชั่วโมง'],
    answer:
      'ระบบจองห้องประชุมผ่าน LINE ให้ลูกค้าดูรูปห้อง จำนวนที่นั่ง และราคาของแต่ละห้อง แล้วเลือกชั่วโมงที่ยังว่างจาก LINE OA ได้เอง ห้องที่ถูกจองแล้วจะขึ้นว่าเต็มจึงไม่มีจองซ้อน เจ้าของพื้นที่เห็นตารางทุกห้องและยอดชำระในหลังบ้านเดียว',
    painPoints: [
      'ลูกค้าทักถามห้องว่างทีละราย ต้องเปิดตารางเช็กทุกครั้ง',
      'จดตารางห้องในชีตหลายคน ห้องเดียวกันถูกจองซ้อน',
      'ประชุมเกินเวลาแล้วไม่รู้ว่าคิวถัดไปจองห้องนี้ไว้หรือเปล่า',
    ],
    benefits: [
      'ตั้งราคาต่อห้องได้ ห้องเล็ก ห้องทีม บอร์ดรูม คิดไม่เท่ากัน',
      'ลูกค้าดูรูปห้องและจำนวนที่นั่งก่อนเลือก บังคับเลือกห้องได้',
      'เลือกได้สูงสุด 4 ชั่วโมงในการจองครั้งเดียวเมื่อเปิดจองหลายช่อง',
      'ซิงก์คิวเข้า Google Calendar และดูรายงานการใช้ห้องเป็น PDF/CSV',
    ],
    faqs: [
      { q: 'ระบบจองห้องประชุมผ่าน LINE ตั้งราคาแต่ละห้องไม่เท่ากันได้ไหม', a: 'ได้ ตั้งราคาต่อห้องต่อชั่วโมงได้ เช่น ห้อง 4 ที่นั่ง 250 บาท บอร์ดรูม 800 บาท ลูกค้าเห็นราคาตอนเลือกห้องและชำระตามห้องที่เลือก' },
      { q: 'ลูกค้าดูรูปห้องประชุมก่อนจองได้ไหม', a: 'ได้ ใส่รูปห้องได้สูงสุด 5 รูปพร้อมรายละเอียด เช่น จำนวนที่นั่งหรืออุปกรณ์ ลูกค้ากดดูรูปในหน้าจองได้ก่อนตัดสินใจ' },
      { q: 'ห้องประชุมขอต่อเวลาหลังเริ่มประชุมแล้วทำได้ไหม', a: 'ได้ พนักงานกดต่อเวลาจากหลังบ้าน ระบบตรวจว่าห้องว่างต่อจากคิวเดิมก่อน ถ้ามีคนจองต่อแล้วจะต่อไม่ได้ ส่วนค่าห้องช่วงที่ต่อเก็บที่หน้าเคาน์เตอร์' },
      { q: 'จองห้องอบรมใหญ่ให้แอดมินยืนยันก่อนได้ไหม', a: 'ได้ ตั้งบริการห้องอบรมให้ต้องรอร้านยืนยัน คำขอจะเข้าคิวรออนุมัติ แอดมินเช็กการจัดห้องแล้วกดยืนยัน ลูกค้าได้ข้อความยืนยันใน LINE' },
      { q: 'co-working มีห้องประชุมหลายสาขาใช้ระบบเดียวได้ไหม', a: 'ได้ เพิ่มหลายสาขาในร้านเดียว แต่ละสาขามีห้องและเวลาเปิดของตัวเอง กำหนดสิทธิ์พนักงานต่อสาขา และดูรายงานรวมหรือแยกสาขาได้' },
    ],
    useCaseSlug: 'meeting-room',
    solutionPath: '/solutions/meeting-room-booking-system',
  },
};
