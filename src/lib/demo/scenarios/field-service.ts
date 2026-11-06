import type { BusinessScenario } from './types';

/** On-site technician team (aircon cleaning, CCTV install): each team is one resource, big jobs confirmed by the office. */
export const fieldServiceScenario: BusinessScenario = {
  type: 'field_service',
  slug: 'field-service',
  label: 'ทีมช่างนอกสถานที่',
  icon: '🧰',
  shopName: 'ช่างเย็นใจ แอร์แอนด์ซีซีทีวี',
  branchName: 'สำนักงานนนทบุรี',
  openTime: '08:00',
  closeTime: '18:00',
  slotMinutes: 60,
  resourceLabel: 'ทีมช่าง',
  resourcePicker: 'optional',
  services: [
    { key: 'aircon-clean', name: 'ล้างแอร์ติดผนัง', description: 'ล้างใหญ่ถอดแผง 9,000–18,000 BTU ราคาต่อเครื่อง', icon: '❄️', durationMinutes: 60, price: 600, bookingMode: 'fixed_slot', capacityPerSlot: 1 },
    { key: 'aircon-fix', name: 'ซ่อมแอร์ / เติมน้ำยา', description: 'แอร์ไม่เย็น น้ำหยด ช่างโทรสอบถามอาการก่อนยืนยัน', icon: '🛠️', durationMinutes: 90, price: 0, bookingMode: 'request_approval', capacityPerSlot: 1 },
    { key: 'aircon-install', name: 'ติดตั้งแอร์ใหม่', description: 'รวมท่อน้ำยา 4 เมตร ราคาขึ้นกับหน้างาน', icon: '🏠', durationMinutes: 240, price: 0, bookingMode: 'request_approval', capacityPerSlot: 1 },
    { key: 'cctv-survey', name: 'สำรวจหน้างานกล้องวงจรปิด', description: 'ดูจุดติดตั้ง วางสาย แล้วเสนอราคา ไม่มีค่าใช้จ่าย', icon: '📋', durationMinutes: 60, price: 0, bookingMode: 'fixed_slot', capacityPerSlot: 1 },
    { key: 'cctv-install', name: 'ติดตั้งกล้องวงจรปิด 4 ตัว', description: 'กล้อง 2MP พร้อมเครื่องบันทึก ดูผ่านมือถือได้', icon: '📹', durationMinutes: 300, price: 12900, bookingMode: 'flexible_duration', capacityPerSlot: 1 },
  ],
  resources: [
    { code: 'TEAM-A', name: 'ทีม A (ช่างเอก)', type: 'trainer', capacity: 1, serviceKeys: ['aircon-clean', 'aircon-fix', 'aircon-install'], detail: 'ทีมแอร์ 2 คน · โซนนนทบุรี-ปากเกร็ด' },
    { code: 'TEAM-B', name: 'ทีม B (ช่างหนุ่ม)', type: 'trainer', capacity: 1, serviceKeys: ['aircon-clean', 'aircon-fix'], detail: 'ทีมแอร์ 2 คน · โซนบางใหญ่-บางบัวทอง' },
    { code: 'TEAM-C', name: 'ทีม C (ช่างตั้ม)', type: 'trainer', capacity: 1, serviceKeys: ['cctv-survey', 'cctv-install'], detail: 'ทีมกล้องวงจรปิดและระบบเน็ตเวิร์ก' },
  ],
  queues: [
    { queueNo: 'A001', serviceKey: 'aircon-clean', resourceCode: 'TEAM-A', time: '09:00', status: 'completed', customerName: 'คุณนิด (หมู่บ้านสวนทอง)', phone: '0890009001', payment: { method: 'omise_promptpay', status: 'paid' } },
    { queueNo: 'A002', serviceKey: 'aircon-clean', resourceCode: 'TEAM-B', time: '10:00', status: 'serving', customerName: 'คุณสมชาย', phone: '0890009002', payment: { method: 'bank_transfer', status: 'paid' } },
    { queueNo: 'A003', serviceKey: 'cctv-install', resourceCode: 'TEAM-C', time: '10:00', status: 'called', customerName: 'ร้านข้าวมันไก่เจ๊หมวย', phone: '0890009003', payment: { method: 'bank_transfer', status: 'paid' } },
    { queueNo: 'A004', serviceKey: 'aircon-clean', resourceCode: 'TEAM-A', time: '11:00', status: 'waiting', customerName: 'คุณเบญ (คอนโดริมน้ำ)', phone: '0890009004', payment: { method: 'omise_mobile_banking', status: 'paid' } },
    { queueNo: 'A005', serviceKey: 'cctv-survey', resourceCode: 'TEAM-C', time: '16:00', status: 'confirmed', customerName: 'คุณวรวุฒิ', phone: '0890009005' },
    { queueNo: 'A006', serviceKey: 'aircon-fix', resourceCode: 'TEAM-B', time: '14:00', status: 'pending_approval', customerName: 'คุณแอน', phone: '0890009006' },
    { queueNo: 'A007', serviceKey: 'aircon-install', time: '13:00', status: 'pending_approval', customerName: 'สำนักงานบัญชีศิริกุล', phone: '0890009007' },
  ],
  chats: [
    { role: 'customer', text: 'มีแอร์ 3 เครื่อง ล้างวันเสาร์นี้ได้ไหมครับ' },
    { role: 'bot', text: 'เสาร์นี้ยังว่างช่วง 09:00 และ 13:00 ค่ะ กด "นัดช่าง" เลือกล้างแอร์ แล้วเลือก 3 ช่วงเวลาติดกันสำหรับ 3 เครื่องได้เลย' },
    { role: 'customer', text: 'ช่างจะมาถึงกี่โมง' },
    { role: 'bot', text: 'ช่างออกตามเวลาที่จองค่ะ ก่อนวันนัดจะมีข้อความเตือนใน LINE และเจ้าหน้าที่โทรยืนยันที่อยู่อีกครั้ง' },
  ],
  promos: [
    { title: 'ล้างแอร์ 3 เครื่องขึ้นไป ลดเครื่องละ 100', subtitle: 'จองผ่าน LINE ทุกวันจันทร์–ศุกร์', cta: 'นัดช่าง' },
    { title: 'สำรวจหน้างานกล้องวงจรปิดฟรี', subtitle: 'ช่างดูจุดติดตั้งแล้วเสนอราคาให้ก่อน', cta: 'นัดสำรวจ' },
  ],
  signage: { template: 'timeline', theme: 'day_teal' },
  seo: {
    title: 'ทดลองระบบนัดช่างล้างแอร์ ติดตั้งกล้องวงจรปิด ผ่าน LINE',
    description: 'ทดลองระบบนัดคิวทีมช่างผ่าน LINE ฟรี ไม่ต้องสมัคร ลูกค้านัดล้างแอร์ ติดตั้งกล้องวงจรปิดเองได้ งานติดตั้งร้านยืนยันก่อน ดูตารางงานทุกทีมช่างในหน้าเดียว',
    h1: 'ทดลองระบบนัดคิวทีมช่างนอกสถานที่ผ่าน LINE',
    keywords: ['ระบบนัดช่างล้างแอร์', 'โปรแกรมจัดคิวช่างแอร์', 'ระบบนัดติดตั้งกล้องวงจรปิด', 'จองคิวช่างผ่าน LINE', 'ระบบจัดตารางทีมช่าง'],
    answer:
      'ระบบนัดคิวทีมช่างผ่าน LINE ให้ลูกค้าเลือกงาน เช่น ล้างแอร์หรือสำรวจหน้างานกล้องวงจรปิด แล้วจองวันและเวลาที่ทีมช่างยังว่างได้เองจาก LINE OA ของร้าน แต่ละทีมมีตารางของตัวเองจึงไม่ส่งช่างทีมเดียวไปสองที่พร้อมกัน งานติดตั้งหรืองานซ่อมที่ต้องคุยอาการก่อนตั้งให้สำนักงานยืนยันได้',
    painPoints: [
      'รับนัดทางโทรศัพท์แล้วจดลงกระดาน ส่งทีมเดียวไปสองบ้านเวลาเดียวกัน',
      'หน้าร้อนลูกค้าทักมาถามคิวล้างแอร์จนแอดมินตอบไม่ไหว',
      'ช่างไปถึงแล้วลูกค้าไม่อยู่บ้าน เสียทั้งค่าเดินทางและเวลาทั้งช่วง',
    ],
    benefits: [
      'แต่ละทีมช่างมีตารางของตัวเอง ลูกค้าเห็นเฉพาะเวลาที่ทีมว่าง',
      'งานติดตั้งและงานซ่อมให้สำนักงานยืนยันก่อน ไม่รับงานเกินกำลัง',
      'ส่ง LINE เตือนลูกค้าล่วงหน้าถึง 1 วัน ลดการไปแล้วไม่เจอใคร',
      'งานราคาตายตัวเก็บเงินตอนจองผ่าน PromptPay / แอปธนาคาร / โอนแนบสลิป ไม่จ่ายตามกำหนดระบบยกเลิกคิวให้',
    ],
    faqs: [
      { q: 'ระบบนัดช่างล้างแอร์ แยกตารางงานตามทีมช่างได้ไหม', a: 'ได้ ตั้งแต่ละทีมเป็นหนึ่งรายการให้ลูกค้าเลือก แล้วผูกว่าทีมไหนรับงานอะไร ทีมที่มีนัดแล้วในช่วงนั้นจะไม่เปิดให้จองซ้อน' },
      { q: 'ลูกค้าล้างแอร์หลายเครื่องจองช่างต่อกันหลายชั่วโมงได้ไหม', a: 'ได้เมื่อร้านเปิดการจองหลายช่อง ลูกค้าเลือกได้สูงสุด 4 ช่องในการจองครั้งเดียว และถ้างานหน้างานยาวกว่าที่นัด พนักงานกดต่อเวลาให้ทีมนั้นได้ถ้าช่วงถัดไปยังว่าง' },
      { q: 'งานติดตั้งกล้องวงจรปิดที่ต้องสำรวจก่อน รับจองผ่าน LINE อย่างไร', a: 'เปิดบริการสำรวจหน้างานให้จองเวลาได้ตามปกติ ส่วนงานติดตั้งจริงตั้งเป็นแบบร้านต้องยืนยันก่อน สำนักงานกดยืนยันหลังตกลงราคา ลูกค้าได้ข้อความยืนยันใน LINE' },
      { q: 'ทีมช่างแอร์เก็บค่าล้างแอร์ก่อนออกงานได้ไหม', a: 'ได้ ตั้งราคาให้บริการที่ราคาตายตัว ลูกค้าจ่ายเต็มจำนวนตอนจองผ่าน PromptPay แอปธนาคาร หรือโอนแนบสลิป ถ้าไม่จ่ายภายในเวลาที่กำหนด ระบบยกเลิกคิวให้เองและเวลานั้นกลับมาว่าง งานที่ต้องประเมินหน้างานตั้งราคา 0 แล้วเก็บเงินหน้างาน' },
      { q: 'ช่างล้างแอร์ไปถึงแล้วลูกค้าไม่อยู่ ระบบช่วยได้อย่างไร', a: 'ตั้ง LINE เตือนก่อนนัดได้ตั้งแต่ 15 นาทีถึง 1 วัน ลูกค้าที่ติดธุระกดยกเลิกเองใน LINE ได้ สำนักงานจะเห็นทันทีและจัดทีมไปงานอื่นแทน' },
    ],
    useCaseSlug: 'installation-team',
  },
};
