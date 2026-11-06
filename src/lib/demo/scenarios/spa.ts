import type { BusinessScenario } from './types';

/** Massage shop / day spa: therapists by name, Thai massage by the hour, a couple room confirmed by the shop. */
export const spaScenario: BusinessScenario = {
  type: 'spa',
  slug: 'spa-massage',
  label: 'สปา / ร้านนวด',
  icon: '💆',
  shopName: 'เรือนไม้หอม สปาแอนด์มาสสาจ',
  branchName: 'สาขานิมมานเหมินท์',
  openTime: '10:00',
  closeTime: '22:00',
  slotMinutes: 30,
  resourceLabel: 'หมอนวด',
  resourcePicker: 'optional',
  services: [
    { key: 'thai', name: 'นวดแผนไทย 1 ชม.', description: 'นวดทั้งตัว เน้นคอ บ่า ไหล่', icon: '🙏', durationMinutes: 60, price: 300, bookingMode: 'fixed_slot', capacityPerSlot: 2 },
    { key: 'thai-2h', name: 'นวดแผนไทย 2 ชม.', description: 'นวดเต็มตัวแบบไม่รีบ ประคบสมุนไพรท้ายชั่วโมง', icon: '🌾', durationMinutes: 120, price: 550, bookingMode: 'fixed_slot', capacityPerSlot: 2 },
    { key: 'foot', name: 'นวดเท้า', description: 'กดจุดฝ่าเท้า 60 นาที', icon: '🦶', durationMinutes: 60, price: 350, bookingMode: 'fixed_slot', capacityPerSlot: 3 },
    { key: 'aroma', name: 'นวดน้ำมันอโรมา', description: 'เลือกกลิ่นน้ำมันได้ที่ร้าน 90 นาที', icon: '🌿', durationMinutes: 90, price: 900, bookingMode: 'fixed_slot', capacityPerSlot: 2 },
    { key: 'couple', name: 'แพ็กเกจคู่ ห้องส่วนตัว', description: 'อโรมา + ขัดผิว 2 ท่าน ร้านยืนยันห้องให้', icon: '💑', durationMinutes: 150, price: 3200, bookingMode: 'request_approval', capacityPerSlot: 1 },
  ],
  resources: [
    { code: 'PANG', name: 'หมอนวดแป้ง', type: 'trainer', capacity: 1, serviceKeys: ['thai', 'thai-2h', 'foot', 'aroma'], detail: 'นวดไทยลงน้ำหนัก แก้ออฟฟิศซินโดรม' },
    { code: 'NOI', name: 'หมอนวดน้อย', type: 'trainer', capacity: 1, serviceKeys: ['thai', 'thai-2h', 'foot'], detail: 'กดจุดฝ่าเท้า นวดคอบ่าไหล่' },
    { code: 'LEK', name: 'หมอนวดเล็ก', type: 'trainer', capacity: 1, serviceKeys: ['aroma', 'thai', 'thai-2h'], detail: 'อโรมา มือเบา นวดผ่อนคลาย' },
    { code: 'ROOM-C', name: 'ห้องคู่ จำปี', type: 'service_area', capacity: 2, serviceKeys: ['couple'], detail: 'ห้องส่วนตัว อ่างแช่เท้า ห้องอาบน้ำในตัว' },
  ],
  queues: [
    { queueNo: 'A001', serviceKey: 'thai', resourceCode: 'PANG', time: '12:00', status: 'completed', customerName: 'คุณสมชาย', phone: '0840003001', payment: { method: 'omise_promptpay', status: 'paid' } },
    { queueNo: 'A002', serviceKey: 'aroma', resourceCode: 'LEK', time: '14:00', status: 'serving', customerName: 'Ms. Emma', phone: '0840003002', payment: { method: 'omise_promptpay', status: 'paid' } },
    { queueNo: 'A003', serviceKey: 'foot', resourceCode: 'NOI', time: '15:00', status: 'called', customerName: 'คุณนก', phone: '0840003003' },
    { queueNo: 'A004', serviceKey: 'foot', time: '15:00', status: 'waiting', customerName: 'คุณป้อม', phone: '0840003004' },
    { queueNo: 'A005', serviceKey: 'thai-2h', resourceCode: 'PANG', time: '16:00', status: 'confirmed', customerName: 'คุณวิทย์', phone: '0840003005', payment: { method: 'bank_transfer', status: 'awaiting_verification' } },
    { queueNo: 'A006', serviceKey: 'couple', resourceCode: 'ROOM-C', time: '19:00', status: 'pending_approval', customerName: 'คุณตาล', phone: '0840003006', partySize: 2, payment: { method: 'bank_transfer', status: 'pending_payment' } },
  ],
  chats: [
    { role: 'customer', text: 'คืนนี้ทุ่มนึงนวดไทย 2 ชั่วโมงได้ไหมคะ' },
    { role: 'bot', text: 'คืนนี้ 19:00 ยังว่างค่ะ กด "จองนวด" แล้วเลือก "นวดแผนไทย 2 ชม." ได้เลย' },
    { role: 'customer', text: 'อยากได้หมอนวดแป้ง มือหนักๆ' },
    { role: 'bot', text: 'เลือก "หมอนวดแป้ง" ในขั้นเลือกหมอนวดได้เลยค่ะ ระบบจะโชว์เฉพาะเวลาที่หมอแป้งว่าง' },
  ],
  promos: [
    { title: 'นวดไทย 2 ชม. 550 บาท', subtitle: 'จันทร์–พฤหัส ก่อน 17:00', cta: 'จองนวด' },
    { title: 'แพ็กเกจคู่ ฉลองครบรอบ', subtitle: 'ห้องส่วนตัว พร้อมชาสมุนไพรหลังนวด', cta: 'ขอจองห้องคู่' },
  ],
  signage: { template: 'minimal', theme: 'day_teal' },
  seo: {
    title: 'ทดลองระบบจองคิวร้านนวด สปา ผ่าน LINE',
    description: 'ทดลองระบบจองคิวร้านนวดและสปาผ่าน LINE ฟรี ไม่ต้องสมัคร ลูกค้าเลือกหมอนวดและเวลาว่างเอง นวด 2 ชั่วโมงก็กันเวลาให้ครบ ห้องคู่ให้ร้านยืนยันก่อน',
    h1: 'ทดลองระบบจองคิวร้านนวดและสปาผ่าน LINE',
    keywords: ['ระบบจองคิวร้านนวด', 'ระบบจองคิวสปา', 'จองคิวนวดผ่าน LINE', 'โปรแกรมจองคิวร้านนวดแผนไทย', 'ระบบนัดหมอนวด'],
    answer:
      'ระบบจองคิวร้านนวดผ่าน LINE ให้ลูกค้าเลือกประเภทการนวด เลือกหมอนวดที่ถูกมือหรือไม่ระบุ และเลือกเวลาที่ยังว่างได้ใน LINE OA ของร้าน นวด 1 ชั่วโมงกับ 2 ชั่วโมงตั้งเป็นคนละบริการ ระบบกันเวลาหมอนวดตามความยาวจริง ส่วนห้องคู่หรือแพ็กเกจพิเศษตั้งให้ร้านกดยืนยันก่อน หมอนวดแต่ละคนจึงไม่ถูกจองซ้อน',
    painPoints: [
      'ลูกค้าโทรถามว่าหมอนวดคนโปรดว่างไหม พนักงานหน้าร้านรับสายไม่ทัน',
      'ลูกค้า walk-in กับลูกค้าที่โทรจองมาชนกันช่วงหัวค่ำ',
      'นวด 1 ชั่วโมงกับ 3 ชั่วโมงจดรวมในสมุด ดูไม่ออกว่าหมอว่างกี่โมง',
    ],
    benefits: [
      'ลูกค้าเลือกหมอนวดเองใน LINE และเห็นเฉพาะเวลาที่หมอคนนั้นว่าง',
      'นวด 2 ชั่วโมงกันเวลาหมอนวดไว้ทั้งช่วง คิวถัดไปไม่ทับ',
      'ห้องคู่โชว์รูปห้องตอนเลือก และให้ร้านยืนยันก่อนรับคิว',
      'ส่งข้อความขอบคุณพร้อมปุ่มรีวิว Google หลังนวดเสร็จ ช่วยให้ร้านติดอันดับในแผนที่',
    ],
    faqs: [
      { q: 'ระบบจองคิวร้านนวดรองรับนวด 1 ชั่วโมงกับ 2 ชั่วโมงในตารางเดียวกันได้ไหม', a: 'ได้ ตั้งเป็นบริการแยกกัน แต่ละบริการมีระยะเวลาและราคาของตัวเอง เมื่อลูกค้าจองนวด 2 ชั่วโมง ระบบกันเวลาหมอนวดคนนั้นไว้ครบ 2 ชั่วโมง ลูกค้าคนอื่นจะจองหมอคนเดิมได้หลังจากนั้น' },
      { q: 'ลูกค้าสปาเลือกหมอนวดคนโปรดตอนจองได้ไหม', a: 'ได้ ลูกค้าเลือกหมอนวดจากรายชื่อหรือเลือก "ไม่ระบุ" และร้านผูกได้ว่าหมอนวดคนไหนรับบริการอะไร เช่น บางคนนวดน้ำมันไม่ได้ก็จะไม่ขึ้นตอนจองอโรมา' },
      { q: 'ร้านนวดมีห้องคู่ ให้ลูกค้าดูรูปห้องก่อนจองได้ไหม', a: 'ได้ ใส่รูปห้องได้ ลูกค้าเห็นรูปตอนเลือกห้องใน LINE และตั้งให้การจองห้องคู่ต้องรอร้านยืนยันก่อนได้' },
      { q: 'ร้านนวดที่มีลูกค้า walk-in เยอะ ใช้ระบบจองคิวผ่าน LINE ด้วยได้ไหม', a: 'ได้ ตั้งจำนวนคิวต่อรอบตามจำนวนหมอนวดที่ว่าง เหลือที่ไว้รับลูกค้าหน้าร้าน พนักงานลงคิว walk-in จากหลังบ้านได้ และเปิดจอทีวีเรียกคิวในเบราว์เซอร์ให้ลูกค้าที่นั่งรอดู' },
      { q: 'ร้านนวดส่ง LINE ชวนลูกค้าเก่ากลับมานวดอีกได้ไหม', a: 'ได้ในแพ็กเกจ Professional ขึ้นไป ระบบดูรอบที่ลูกค้าเคยมานวด แล้วส่งข้อความชวนกลับทาง LINE เมื่อเลยรอบปกติของลูกค้าคนนั้น' },
    ],
  },
};
