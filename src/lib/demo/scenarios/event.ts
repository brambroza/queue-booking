import type { BusinessScenario } from './types';

/** One-day seminar / workshop event: seats per session, 1:1 expert booths, vendor booth requests. */
export const eventScenario: BusinessScenario = {
  type: 'event',
  slug: 'event-seminar',
  label: 'งานสัมมนา',
  icon: '🎟️',
  shopName: 'เถ้าแก่ใหม่ เดย์ 2026',
  branchName: 'ฮอลล์ 2 ศูนย์ประชุมเมืองทอง',
  openTime: '09:00',
  closeTime: '17:00',
  slotMinutes: 30,
  resourceLabel: 'ห้อง / ผู้เชี่ยวชาญ',
  resourcePicker: 'optional',
  services: [
    { key: 'seminar', name: 'ที่นั่งสัมมนา "ขายของออนไลน์ปี 2026"', description: '1 การจอง = 1 ที่นั่ง รอบละ 2 ชั่วโมง รับรอบละ 120 ที่', icon: '🎤', durationMinutes: 120, price: 390, bookingMode: 'capacity_based', capacityPerSlot: 120 },
    { key: 'workshop', name: 'เวิร์กช็อปยิงแอดฉบับร้านเล็ก', description: 'กลุ่มเล็ก 24 ที่ นำโน้ตบุ๊กมาเอง', icon: '💻', durationMinutes: 180, price: 1290, bookingMode: 'capacity_based', capacityPerSlot: 24 },
    { key: 'clinic', name: 'นั่งคุยตัวต่อตัวกับผู้เชี่ยวชาญ', description: '20 นาที ฟรีสำหรับผู้ลงทะเบียน', icon: '🤝', durationMinutes: 20, price: 0, bookingMode: 'fixed_slot', capacityPerSlot: 1 },
    { key: 'booth', name: 'ขอพื้นที่บูธออกร้าน', description: 'บูธ 3×3 ม. ทีมงานคัดเลือกและยืนยัน', icon: '🏪', durationMinutes: 480, price: 2500, bookingMode: 'request_approval', capacityPerSlot: 1 },
  ],
  resources: [
    { code: 'HALL-A', name: 'ห้องสัมมนาใหญ่ A', type: 'service_area', capacity: 120, serviceKeys: ['seminar'], detail: '120 ที่นั่ง · จอ LED' },
    { code: 'ROOM-B', name: 'ห้องเวิร์กช็อป B', type: 'meeting_room', capacity: 24, serviceKeys: ['workshop'], detail: '24 ที่ · มีปลั๊กทุกโต๊ะ' },
    { code: 'EXP-TAX', name: 'คุณนภา (ภาษีร้านออนไลน์)', type: 'trainer', capacity: 1, serviceKeys: ['clinic'], detail: 'นักบัญชีรับอนุญาต' },
    { code: 'EXP-ADS', name: 'คุณเก่ง (โฆษณาเฟซบุ๊ก/ติ๊กต็อก)', type: 'trainer', capacity: 1, serviceKeys: ['clinic'], detail: 'ที่ปรึกษาการตลาด' },
    { code: 'ZONE-FAIR', name: 'โซนบูธออกร้าน', type: 'service_area', capacity: 40, serviceKeys: ['booth'], detail: '40 บูธ · ไฟ 1 ปลั๊ก/บูธ' },
  ],
  queues: [
    { queueNo: 'A001', serviceKey: 'seminar', resourceCode: 'HALL-A', time: '09:30', status: 'completed', customerName: 'คุณดาว (ร้านเสื้อผ้า)', phone: '0850009001', payment: { method: 'omise_promptpay', status: 'paid' } },
    { queueNo: 'A002', serviceKey: 'workshop', resourceCode: 'ROOM-B', time: '10:00', status: 'serving', customerName: 'คุณต่อ', phone: '0850009002', payment: { method: 'omise_mobile_banking', status: 'paid' } },
    { queueNo: 'A003', serviceKey: 'clinic', resourceCode: 'EXP-TAX', time: '11:00', status: 'called', customerName: 'คุณอ้อย (ขายเบเกอรี่)', phone: '0850009003' },
    { queueNo: 'A004', serviceKey: 'clinic', resourceCode: 'EXP-ADS', time: '11:00', status: 'waiting', customerName: 'คุณแบงก์', phone: '0850009004' },
    { queueNo: 'A005', serviceKey: 'seminar', resourceCode: 'HALL-A', time: '13:30', status: 'checked_in', customerName: 'คุณมุก', phone: '0850009005', payment: { method: 'bank_transfer', status: 'paid' } },
    { queueNo: 'A006', serviceKey: 'booth', resourceCode: 'ZONE-FAIR', time: '09:00', status: 'pending_approval', customerName: 'ร้านน้ำพริกแม่ศรี', phone: '0850009006', payment: { method: 'bank_transfer', status: 'awaiting_verification' } },
  ],
  chats: [
    { role: 'customer', text: 'สัมมนารอบบ่ายยังมีที่ไหมคะ ไป 2 คน' },
    { role: 'bot', text: 'รอบ 13:30 ยังมีที่ค่ะ กด "ลงทะเบียน" ที่เมนู เลือกรอบได้เลย 1 การจองได้ 1 ที่นั่ง มา 2 คนให้แต่ละคนลงทะเบียนจาก LINE ของตัวเองนะคะ' },
    { role: 'customer', text: 'วันงานต้องเอาอะไรไปยืนยันไหม' },
    { role: 'bot', text: 'ถึงหน้าห้องแล้วกด "ฉันมาถึงแล้ว" ในหน้าคิวของฉันใน LINE ทีมงานเห็นทันทีค่ะ ไม่ต้องพิมพ์บัตร' },
  ],
  promos: [
    { title: 'Early Bird ลด 100 บาท', subtitle: 'ลงทะเบียนสัมมนาก่อน 30 พ.ย.', cta: 'ลงทะเบียน' },
    { title: 'ฟรี! คุยตัวต่อตัว 20 นาที', subtitle: 'ผู้ลงทะเบียนสัมมนาจองคิวผู้เชี่ยวชาญได้ 1 คิว', cta: 'จองคิวปรึกษา' },
  ],
  signage: { template: 'spotlight', theme: 'day_indigo' },
  seo: {
    title: 'ทดลองระบบลงทะเบียนสัมมนา อีเวนต์ จองบูธ ผ่าน LINE',
    description: 'ทดลองระบบลงทะเบียนงานสัมมนาผ่าน LINE ฟรี ไม่ต้องสมัคร จำกัดที่นั่งต่อรอบ เปิดลงทะเบียนตามเวลาที่ประกาศ ผู้เข้าร่วมกดเช็คอินหน้างานจากไลน์ได้เลย',
    h1: 'ทดลองระบบลงทะเบียนงานสัมมนาและอีเวนต์ผ่าน LINE',
    keywords: ['ระบบลงทะเบียนสัมมนา', 'ลงทะเบียนงานอีเวนต์ผ่าน LINE', 'ระบบจองที่นั่งเวิร์กช็อป', 'ระบบเช็คอินงานสัมมนา', 'ระบบจองบูธงานแฟร์'],
    answer:
      'ระบบลงทะเบียนสัมมนาผ่าน LINE ให้ผู้เข้าร่วมเลือกรอบและชำระค่าลงทะเบียนหนึ่งที่นั่งต่อการจองจาก LINE OA ของงาน รอบที่ที่นั่งครบแล้วจะขึ้นว่าเต็ม ผู้จัดตั้งวันที่เปิดรับและนับถอยหลังก่อนเปิดลงทะเบียนได้ วันงานผู้เข้าร่วมกดเช็คอินจาก LINE แทนการต่อแถวหน้าห้อง',
    painPoints: [
      'รับลงทะเบียนผ่านฟอร์มแล้วต้องไล่เช็กยอดโอนเองทีละคน',
      'ที่นั่งเกินห้อง เพราะนับยอดจากหลายช่องทางไม่ตรงกัน',
      'วันงานแถวลงทะเบียนยาว เช็กชื่อจากกระดาษไม่ทัน',
    ],
    benefits: [
      'จำกัดที่นั่งต่อรอบ สัมมนาและเวิร์กช็อปนับแยกกัน',
      'ตั้งวันเปิดรับลงทะเบียนเฉพาะช่วงวันงาน พร้อมหน้านับถอยหลัง',
      'ผู้เข้าร่วมกด "ฉันมาถึงแล้ว" ทีมงานเห็นรายชื่อเช็คอินทันที',
      'คำขอบูธออกร้านเข้าคิวรออนุมัติ ทีมงานคัดเลือกก่อนยืนยัน',
    ],
    faqs: [
      { q: 'ระบบลงทะเบียนงานสัมมนาผ่าน LINE จำกัดที่นั่งแต่ละรอบได้ไหม', a: 'ได้ ตั้งจำนวนที่รับต่อรอบของแต่ละหัวข้อ ครบแล้วรอบนั้นขึ้นว่าเต็มและลงทะเบียนเพิ่มไม่ได้ ผู้เข้าร่วมเลือกรอบอื่นที่ยังว่างแทน' },
      { q: 'งานอีเวนต์ตั้งเวลาเปิดลงทะเบียนพร้อมกันทุกคนได้ไหม', a: 'ได้ ตั้งเวลาเปิดรับของสาขาหรือสถานที่จัดงาน ก่อนถึงเวลาผู้เข้าร่วมจะเห็นหน้านับถอยหลัง และกำหนดให้เลือกได้เฉพาะวันที่จัดงานเท่านั้น' },
      { q: 'วันงานสัมมนาเช็คอินผู้เข้าร่วมผ่าน LINE ได้อย่างไร', a: 'ผู้เข้าร่วมเปิดหน้าคิวของฉันใน LINE แล้วกด "ฉันมาถึงแล้ว" ได้ในวันงาน สถานะคิวเปลี่ยนเป็นเช็คอินและทีมงานเห็นในหลังบ้านทันที' },
      { q: 'งานแฟร์รับสมัครบูธออกร้านแล้วให้ทีมงานคัดเลือกก่อนได้ไหม', a: 'ได้ ตั้งบริการขอพื้นที่บูธให้ต้องรออนุมัติ ผู้สมัครส่งคำขอพร้อมชำระเงิน ทีมงานกดยืนยันหรือยกเลิก และผู้สมัครได้ข้อความแจ้งผลใน LINE' },
      { q: 'งานสัมมนามีคิวปรึกษาผู้เชี่ยวชาญ ให้ผู้เข้าร่วมเลือกคนเองได้ไหม', a: 'ได้ เพิ่มผู้เชี่ยวชาญแต่ละท่านเป็นตัวเลือก ผูกกับหัวข้อที่ให้คำปรึกษา ผู้เข้าร่วมเลือกคนและเวลาที่ว่าง เมื่อถึงคิวทีมงานกดเรียกและผู้เข้าร่วมได้ข้อความใน LINE' },
    ],
  },
};
