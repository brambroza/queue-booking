import type { BusinessScenario } from './types';

/** Pet grooming shop: groomers by name, full grooms take a variable time, cats confirmed by the shop, pet names on the TV. */
export const petScenario: BusinessScenario = {
  type: 'pet',
  slug: 'pet-grooming',
  label: 'อาบน้ำตัดขนสัตว์เลี้ยง',
  icon: '🐶',
  shopName: 'ขนฟู เพ็ทกรูมมิ่ง',
  branchName: 'สาขาประชาชื่น',
  openTime: '09:00',
  closeTime: '19:00',
  slotMinutes: 30,
  resourceLabel: 'ช่างกรูม',
  resourcePicker: 'optional',
  services: [
    { key: 'bath-small', name: 'อาบน้ำ เป่าขน (หมาเล็ก)', description: 'ไม่เกิน 10 กก. ตัดเล็บ เช็ดหู รวมแล้ว', icon: '🛁', durationMinutes: 60, price: 350, bookingMode: 'fixed_slot', capacityPerSlot: 2 },
    { key: 'bath-large', name: 'อาบน้ำ เป่าขน (หมากลาง–ใหญ่)', description: '10 กก. ขึ้นไป แจ้งน้ำหนักน้องในหมายเหตุ', icon: '🐕', durationMinutes: 90, price: 550, bookingMode: 'fixed_slot', capacityPerSlot: 1 },
    { key: 'full-groom', name: 'อาบน้ำ + ตัดแต่งขนทั้งตัว', description: 'เวลาขึ้นกับขนและนิสัยน้อง 2–3 ชั่วโมง', icon: '✂️', durationMinutes: 120, price: 750, bookingMode: 'flexible_duration', capacityPerSlot: 1 },
    { key: 'cat-bath', name: 'อาบน้ำแมว', description: 'ร้านสอบถามนิสัยน้องก่อนยืนยันคิว', icon: '🐱', durationMinutes: 90, price: 600, bookingMode: 'request_approval', capacityPerSlot: 1 },
  ],
  resources: [
    { code: 'PUK', name: 'พี่ปุ๊ก', type: 'trainer', capacity: 1, detail: 'ตัดทรงพุดเดิ้ล ชิสุ ปอม' },
    { code: 'TAR', name: 'พี่ต้าร์', type: 'trainer', capacity: 1, serviceKeys: ['bath-small', 'bath-large', 'full-groom'], detail: 'หมาใหญ่ โกลเด้น ไซบีเรียน' },
    { code: 'MIN', name: 'พี่มิ้น', type: 'trainer', capacity: 1, serviceKeys: ['bath-small', 'cat-bath'], detail: 'ถนัดแมวและน้องขี้กลัว' },
  ],
  queues: [
    { queueNo: 'A001', serviceKey: 'bath-small', resourceCode: 'MIN', time: '09:30', status: 'completed', customerName: 'คุณแอน', nickname: 'น้องถั่วเหลือง 🐶', phone: '0870006001', payment: { method: 'omise_promptpay', status: 'paid' } },
    { queueNo: 'A002', serviceKey: 'full-groom', resourceCode: 'PUK', time: '10:00', status: 'serving', customerName: 'คุณบอย', nickname: 'น้องโมจิ 🐩', phone: '0870006002', payment: { method: 'omise_promptpay', status: 'paid' } },
    { queueNo: 'A003', serviceKey: 'bath-large', resourceCode: 'TAR', time: '11:00', status: 'called', customerName: 'คุณเก่ง', nickname: 'น้องข้าวตู 🦮', phone: '0870006003', payment: { method: 'bank_transfer', status: 'paid' } },
    { queueNo: 'A004', serviceKey: 'bath-small', time: '11:00', status: 'waiting', customerName: 'คุณหมิว', nickname: 'น้องเปาเปา 🐶', phone: '0870006004' },
    { queueNo: 'A005', serviceKey: 'full-groom', resourceCode: 'PUK', time: '13:00', status: 'confirmed', customerName: 'คุณตูน', nickname: 'น้องบราวนี่ 🐕', phone: '0870006005', payment: { method: 'omise_mobile_banking', status: 'paid' } },
    { queueNo: 'A006', serviceKey: 'cat-bath', resourceCode: 'MIN', time: '14:00', status: 'pending_approval', customerName: 'คุณนิว', nickname: 'น้องส้มจี๊ด 🐱', phone: '0870006006', payment: { method: 'bank_transfer', status: 'pending_payment' } },
  ],
  chats: [
    { role: 'customer', text: 'น้องเป็นชิสุ 6 โล อาบน้ำตัดขนวันเสาร์ได้ไหมคะ' },
    { role: 'bot', text: 'เสาร์นี้ยังว่าง 10:00 และ 13:30 ค่ะ เลือก "อาบน้ำ + ตัดแต่งขนทั้งตัว" แล้วใส่ชื่อน้องตอนจองได้เลย' },
    { role: 'customer', text: 'มีอาบน้ำแมวไหม น้องขี้กลัวมาก' },
    { role: 'bot', text: 'มีค่ะ ส่งคำขอจอง "อาบน้ำแมว" ไว้ได้เลย พี่มิ้นจะทักถามนิสัยน้องก่อนยืนยันคิวทาง LINE' },
  ],
  promos: [
    { title: 'อาบน้ำครบ 5 ครั้ง ตัดเล็บฟรี', subtitle: 'แจ้งพนักงานที่หน้าร้านได้เลย', cta: 'จองอาบน้ำ' },
    { title: 'ตัดขนรับหน้าร้อน ลด 10%', subtitle: 'จองวันจันทร์–พฤหัส', cta: 'จองตัดขน' },
  ],
  signage: { template: 'lane', theme: 'day_lime' },
  seo: {
    title: 'ทดลองระบบจองคิวอาบน้ำตัดขนสัตว์เลี้ยงผ่าน LINE',
    description: 'ทดลองระบบจองคิวร้านอาบน้ำตัดขนหมาแมวผ่าน LINE ฟรี ไม่ต้องสมัคร เจ้าของเลือกช่างกรูมและเวลาว่างเอง ชื่อน้องขึ้นจอทีวี ได้ LINE แจ้งตอนเรียกคิว',
    h1: 'ทดลองระบบจองคิวร้านอาบน้ำตัดขนสัตว์เลี้ยงผ่าน LINE',
    keywords: ['ระบบจองคิวอาบน้ำตัดขนสุนัข', 'จองคิวกรูมมิ่งผ่าน LINE', 'ระบบจองคิวร้านสัตว์เลี้ยง', 'โปรแกรมจองคิวอาบน้ำหมาแมว', 'ระบบนัดหมายร้าน pet grooming'],
    answer:
      'ระบบจองคิวร้านอาบน้ำตัดขนสัตว์เลี้ยงผ่าน LINE ให้เจ้าของเลือกบริการตามขนาดน้อง เลือกช่างกรูมหรือไม่ระบุ แล้วเลือกเวลาที่ยังว่างใน LINE OA ของร้านได้เลย งานตัดขนทั้งตัวกันเวลาช่างไว้นานกว่าอาบน้ำ ส่วนอาบน้ำแมวตั้งให้ร้านยืนยันก่อนได้ ชื่อน้องขึ้นบนจอทีวีหน้าร้าน และเจ้าของได้ LINE แจ้งเมื่อถึงคิว',
    painPoints: [
      'เจ้าของทักแชทถามคิวพร้อมส่งรูปน้อง ช่างกรูมมือเปียกตอบไม่ได้',
      'หมาใหญ่ตัดขนนานเกิน คิวถัดไปต้องนั่งรอพร้อมน้องที่ตื่นเต้น',
      'จดชื่อเจ้าของในสมุด แต่จำได้แค่ชื่อน้อง หาคิวไม่เจอ',
    ],
    benefits: [
      'เจ้าของใส่ชื่อน้องตอนจอง ชื่อน้องขึ้นบนจอทีวีเรียกคิวหน้าร้าน',
      'แยกบริการตามขนาดน้อง แต่ละแบบกันเวลาช่างกรูมต่างกัน คิวไม่ทับ',
      'ผูกช่างกับบริการได้ งานแมวไปที่ช่างที่ถนัดแมวเท่านั้น',
      'ส่ง LINE เตือนก่อนถึงคิว และแจ้งทันทีเมื่อร้านเรียกคิว',
    ],
    faqs: [
      { q: 'ร้านอาบน้ำตัดขนสุนัขให้ชื่อน้องขึ้นบนจอเรียกคิวได้ไหม', a: 'ได้ เจ้าของใส่ชื่อน้องตอนจองใน LINE ชื่อนั้นขึ้นบนจอทีวีเรียกคิวหน้าร้าน จอเปิดในเบราว์เซอร์ใดก็ได้และมีให้เลือกหลายแบบ' },
      { q: 'ร้านกรูมมิ่งแยกราคาและเวลาตามขนาดหมาได้ไหม', a: 'ได้ ตั้งเป็นบริการแยกกัน เช่น หมาเล็กกับหมากลางถึงใหญ่ แต่ละบริการมีราคาและระยะเวลาของตัวเอง ระบบกันเวลาช่างกรูมตามบริการที่เจ้าของเลือก' },
      { q: 'ร้านอาบน้ำแมวตั้งให้ต้องคุยกับเจ้าของก่อนรับคิวได้ไหม', a: 'ได้ ตั้งบริการอาบน้ำแมวเป็นแบบต้องให้ร้านอนุมัติ คิวขึ้นสถานะรออนุมัติ ร้านทักถามนิสัยน้องผ่านแชท LINE ในหลังบ้าน แล้วกดยืนยัน เจ้าของได้ข้อความแจ้งทันที' },
      { q: 'เจ้าของหมาไม่อยากนั่งรอที่ร้านกรูมมิ่งนาน ระบบช่วยได้ไหม', a: 'ช่วยได้ ระบบส่ง LINE เตือนก่อนถึงคิวตามเวลาที่ร้านตั้ง ตั้งแต่ 15 นาทีถึง 1 วัน และเมื่อร้านกดเรียกคิว เจ้าของได้ข้อความใน LINE ทันที จึงพาน้องมาตรงเวลาได้โดยไม่ต้องมารอก่อน' },
      { q: 'ร้านอาบน้ำตัดขนสัตว์เลี้ยงชวนลูกค้ากลับมาอาบน้ำตามรอบได้ไหม', a: 'ได้ในแพ็กเกจ Professional ขึ้นไป ระบบดูว่าเจ้าของพาน้องมาทุกกี่สัปดาห์ แล้วส่ง LINE ชวนกลับมาเมื่อเลยรอบนั้น' },
    ],
  },
};
