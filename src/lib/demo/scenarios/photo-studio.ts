import type { BusinessScenario } from './types';

/** Portrait / family photo studio with several sets, packages confirmed by the shop, self-shoot rental by the hour. */
export const photoStudioScenario: BusinessScenario = {
  type: 'photo_studio',
  slug: 'photo-studio',
  label: 'สตูดิโอถ่ายภาพ',
  icon: '📸',
  shopName: 'แสงเช้า สตูดิโอ',
  branchName: 'สาขาลาดพร้าว 71',
  openTime: '10:00',
  closeTime: '20:00',
  slotMinutes: 30,
  resourceLabel: 'สตูดิโอ',
  resourcePicker: 'optional',
  services: [
    { key: 'profile', name: 'ถ่ายรูปโปรไฟล์ / สมัครงาน', description: '30 นาที ได้ไฟล์แต่ง 3 รูป', icon: '👔', durationMinutes: 30, price: 690, bookingMode: 'fixed_slot', capacityPerSlot: 1 },
    { key: 'family', name: 'ถ่ายภาพครอบครัว / คู่รัก', description: '1 ชั่วโมง ไม่เกิน 6 ท่าน ได้ไฟล์แต่ง 15 รูป', icon: '👨‍👩‍👧', durationMinutes: 60, price: 2490, bookingMode: 'fixed_slot', capacityPerSlot: 1 },
    { key: 'graduation', name: 'แพ็กเกจรับปริญญา / พรีเวดดิ้งในสตูดิโอ', description: '3 ชั่วโมง ทีมงานโทรคุยคอนเซปต์ก่อนยืนยัน', icon: '🎓', durationMinutes: 180, price: 8900, bookingMode: 'request_approval', capacityPerSlot: 1 },
    { key: 'rental', name: 'เช่าสตูดิโอถ่ายเอง', description: 'ชั่วโมงละ 900 บาท รวมไฟสตูดิโอ 2 ชุด', icon: '💡', durationMinutes: 60, price: 900, bookingMode: 'flexible_duration', capacityPerSlot: 1 },
  ],
  resources: [
    { code: 'ST-A', name: 'สตูดิโอ A ฉากขาว', type: 'service_area', capacity: 6, detail: 'ฉากขาวโค้ง · ไฟซอฟต์บ็อกซ์' },
    { code: 'ST-B', name: 'สตูดิโอ B มุมโซฟาวินเทจ', type: 'service_area', capacity: 6, serviceKeys: ['family', 'graduation', 'rental'], detail: 'แสงธรรมชาติ · โซฟาหนัง' },
    { code: 'ST-C', name: 'สตูดิโอ C ฉากสีพาสเทล', type: 'service_area', capacity: 4, serviceKeys: ['profile', 'family', 'rental'], detail: 'เปลี่ยนสีฉากได้ 6 สี' },
  ],
  queues: [
    { queueNo: 'A001', serviceKey: 'profile', resourceCode: 'ST-A', time: '10:30', status: 'completed', customerName: 'คุณฟ้า', phone: '0860010001', payment: { method: 'omise_promptpay', status: 'paid' } },
    { queueNo: 'A002', serviceKey: 'family', resourceCode: 'ST-B', time: '11:00', status: 'serving', customerName: 'ครอบครัวคุณวิชัย', phone: '0860010002', payment: { method: 'bank_transfer', status: 'paid' } },
    { queueNo: 'A003', serviceKey: 'profile', resourceCode: 'ST-C', time: '11:30', status: 'called', customerName: 'คุณเพชร', phone: '0860010003', payment: { method: 'omise_promptpay', status: 'paid' } },
    { queueNo: 'A004', serviceKey: 'profile', time: '12:00', status: 'waiting', customerName: 'คุณกานต์', phone: '0860010004', payment: { method: 'omise_mobile_banking', status: 'paid' } },
    { queueNo: 'A005', serviceKey: 'rental', resourceCode: 'ST-C', time: '14:00', status: 'confirmed', customerName: 'ร้านกระเป๋า Hand Made by Jib', phone: '0860010005', payment: { method: 'bank_transfer', status: 'awaiting_verification' } },
    { queueNo: 'A006', serviceKey: 'graduation', resourceCode: 'ST-A', time: '15:00', status: 'pending_approval', customerName: 'คุณน้ำหวาน', phone: '0860010006', payment: { method: 'bank_transfer', status: 'pending_payment' } },
  ],
  chats: [
    { role: 'customer', text: 'อยากถ่ายรูปสมัครงานด่วน พรุ่งนี้เช้าได้ไหมคะ' },
    { role: 'bot', text: 'พรุ่งนี้ 10:30 และ 11:30 ยังว่างค่ะ กด "จองคิวถ่ายรูป" เลือกสตูดิโอที่ชอบได้ ดูรูปฉากก่อนเลือกได้ค่ะ' },
    { role: 'customer', text: 'ได้ไฟล์ภายในวันไหม' },
    { role: 'bot', text: 'รูปโปรไฟล์ส่งไฟล์แต่งทาง LINE ภายใน 24 ชั่วโมงค่ะ ถ้าต้องการด่วนภายในวันแจ้งพนักงานหน้าร้านได้เลย' },
  ],
  promos: [
    { title: 'รูปโปรไฟล์ 2 คน ลด 20%', subtitle: 'มาถ่ายพร้อมเพื่อน จันทร์–ศุกร์ ก่อน 15:00', cta: 'จองคิวถ่ายรูป' },
    { title: 'เช่าสตูดิโอ 3 ชม. แถมฟรีอีก 1 ชม.', subtitle: 'สำหรับร้านออนไลน์ถ่ายสินค้า', cta: 'จองสตูดิโอ' },
  ],
  signage: { template: 'minimal', theme: 'day_rose' },
  seo: {
    title: 'ทดลองระบบจองคิวสตูดิโอถ่ายภาพ เช่าสตูดิโอ ผ่าน LINE',
    description: 'ทดลองระบบจองคิวสตูดิโอถ่ายภาพผ่าน LINE ฟรี ไม่ต้องสมัคร ลูกค้าดูรูปฉาก เลือกสตูดิโอและเวลาที่ว่าง จ่ายค่าบริการตอนจอง งานแพ็กเกจให้ร้านยืนยันก่อนได้',
    h1: 'ทดลองระบบจองคิวสตูดิโอถ่ายภาพผ่าน LINE',
    keywords: ['ระบบจองคิวสตูดิโอถ่ายภาพ', 'จองสตูดิโอถ่ายรูปผ่าน LINE', 'ระบบเช่าสตูดิโอรายชั่วโมง', 'จองคิวถ่ายรูปโปรไฟล์', 'โปรแกรมจองคิวช่างภาพ'],
    answer:
      'ระบบจองคิวสตูดิโอถ่ายภาพผ่าน LINE ให้ลูกค้าเลือกแพ็กเกจ ดูรูปฉากแต่ละสตูดิโอ แล้วเลือกเวลาที่ยังว่างจาก LINE OA ของร้าน พร้อมชำระค่าบริการเต็มจำนวนตอนจอง งานใหญ่อย่างรับปริญญาหรือพรีเวดดิ้งตั้งให้ร้านยืนยันก่อนได้ ส่วนลูกค้าเช่าสตูดิโอถ่ายเองจองต่อเนื่องหลายชั่วโมงได้',
    painPoints: [
      'ลูกค้าขอดูรูปฉากทางแชททุกครั้งก่อนตัดสินใจจอง',
      'คิวถ่ายรูปกับคิวเช่าสตูดิโอชนกันเพราะจดคนละที่',
      'ลูกค้าจองแพ็กเกจแล้วเลื่อนหรือหายไป ไม่ได้เก็บเงินไว้ก่อน',
    ],
    benefits: [
      'ใส่รูปฉากของแต่ละสตูดิโอ ลูกค้ากดดูก่อนเลือกได้เอง',
      'ผูกสตูดิโอกับแพ็กเกจที่ทำได้ คิวทุกแบบอยู่ในตารางเดียว ไม่ชนกัน',
      'เก็บค่าบริการตอนจองผ่าน PromptPay / แอปธนาคาร / โอนแนบสลิป ไม่จ่ายตามกำหนดระบบยกเลิกคิวให้',
      'หลังถ่ายเสร็จส่งข้อความขอบคุณพร้อมปุ่มรีวิว Google ให้อัตโนมัติ',
    ],
    faqs: [
      { q: 'ระบบจองคิวสตูดิโอถ่ายภาพให้ลูกค้าดูรูปฉากก่อนจองได้ไหม', a: 'ได้ ใส่รูปของแต่ละสตูดิโอได้สูงสุด 5 รูปพร้อมรายละเอียดฉาก ลูกค้ากดดูรูปในหน้าจองใน LINE แล้วเลือกสตูดิโอเอง หรือเลือก "ไม่ระบุ" ให้ร้านจัดให้' },
      { q: 'สตูดิโอถ่ายภาพเก็บค่าแพ็กเกจผ่าน LINE ได้อย่างไร', a: 'ลูกค้าชำระราคาแพ็กเกจเต็มจำนวนผ่าน PromptPay แอปธนาคาร หรือโอนแล้วแนบสลิปตอนจอง ระบบอ่าน QR บนสลิปและเตือนเมื่อเป็นสลิปซ้ำ ถ้าไม่ชำระภายในเวลาที่กำหนด คิวจะถูกยกเลิกเอง' },
      { q: 'แพ็กเกจรับปริญญาของสตูดิโอถ่ายภาพให้ร้านยืนยันก่อนรับงานได้ไหม', a: 'ได้ ตั้งบริการนั้นให้ต้องรอร้านยืนยัน คิวจะอยู่ในสถานะรออนุมัติจนกว่าทีมงานคุยคอนเซปต์และกดยืนยัน แล้วลูกค้าได้ข้อความยืนยันใน LINE' },
      { q: 'ลูกค้าเช่าสตูดิโอถ่ายรูปหลายชั่วโมงต่อกันได้ไหม', a: 'ได้เมื่อเปิดการจองหลายช่อง ลูกค้าเลือกได้สูงสุด 4 ช่องในครั้งเดียว และถ้าถ่ายเกินเวลา พนักงานกดต่อเวลาจากหลังบ้านได้ถ้าสตูดิโอยังว่าง' },
      { q: 'สตูดิโอถ่ายภาพขอรีวิว Google จากลูกค้าผ่าน LINE ได้ไหม', a: 'ได้ เปิดข้อความขอบคุณหลังรับบริการ ระบบส่งหาลูกค้าทาง LINE หลังคิวเสร็จตามเวลาที่ตั้ง พร้อมปุ่มไปหน้ารีวิว Google ของร้านและปุ่มจองครั้งถัดไป' },
    ],
  },
};
