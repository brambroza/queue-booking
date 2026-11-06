import type { BusinessScenario } from './types';

/** Tutoring school: small group classes by seat, private lessons with a chosen teacher, free trial on request. */
export const tutoringScenario: BusinessScenario = {
  type: 'tutoring',
  slug: 'tutoring-class',
  label: 'คลาสเรียนพิเศษ',
  icon: '📚',
  shopName: 'บ้านติวครูแพร',
  branchName: 'สาขาแจ้งวัฒนะ',
  openTime: '09:00',
  closeTime: '20:00',
  slotMinutes: 30,
  resourceLabel: 'ครู',
  resourcePicker: 'optional',
  services: [
    { key: 'math-group', name: 'คลาสกลุ่มคณิต ม.ต้น', description: 'กลุ่มละไม่เกิน 8 คน ครั้งละ 90 นาที', icon: '➗', durationMinutes: 90, price: 350, bookingMode: 'capacity_based', capacityPerSlot: 8 },
    { key: 'english-group', name: 'คลาสกลุ่มอังกฤษ ป.4–ป.6', description: 'เน้นพูดและฟัง กลุ่มละ 6 คน', icon: '🗣️', durationMinutes: 60, price: 300, bookingMode: 'capacity_based', capacityPerSlot: 6 },
    { key: 'private', name: 'เรียนตัวต่อตัว', description: 'เลือกวิชาและครูเองได้ ครั้งละ 1 ชั่วโมง', icon: '✏️', durationMinutes: 60, price: 650, bookingMode: 'fixed_slot', capacityPerSlot: 1 },
    { key: 'trial', name: 'ทดลองเรียนฟรี + วัดระดับ', description: 'ครูประเมินพื้นฐานก่อน ร้านยืนยันเวลาให้', icon: '🎒', durationMinutes: 45, price: 0, bookingMode: 'request_approval', capacityPerSlot: 1 },
  ],
  resources: [
    { code: 'T-PRAE', name: 'ครูแพร', type: 'trainer', capacity: 1, serviceKeys: ['math-group', 'private', 'trial'], detail: 'คณิตศาสตร์ · สอนมา 10 ปี' },
    { code: 'T-OAT', name: 'ครูโอ๊ต', type: 'trainer', capacity: 1, serviceKeys: ['math-group', 'private'], detail: 'คณิต-ฟิสิกส์ · เตรียมสอบเข้า ม.4' },
    { code: 'T-ANN', name: 'Teacher Ann', type: 'trainer', capacity: 1, serviceKeys: ['english-group', 'private', 'trial'], detail: 'ภาษาอังกฤษ · สำเนียงอเมริกัน' },
  ],
  queues: [
    { queueNo: 'A001', serviceKey: 'english-group', resourceCode: 'T-ANN', time: '09:00', status: 'completed', customerName: 'คุณแม่น้องข้าวหอม', nickname: 'น้องข้าวหอม', phone: '0870011001', payment: { method: 'omise_promptpay', status: 'paid' } },
    { queueNo: 'A002', serviceKey: 'math-group', resourceCode: 'T-PRAE', time: '10:00', status: 'serving', customerName: 'คุณพ่อน้องภูมิ', nickname: 'น้องภูมิ', phone: '0870011002', payment: { method: 'bank_transfer', status: 'paid' } },
    { queueNo: 'A003', serviceKey: 'private', resourceCode: 'T-OAT', time: '10:30', status: 'called', customerName: 'คุณแม่น้องต้นกล้า', nickname: 'น้องต้นกล้า', phone: '0870011003', payment: { method: 'omise_promptpay', status: 'paid' } },
    { queueNo: 'A004', serviceKey: 'math-group', resourceCode: 'T-PRAE', time: '10:00', status: 'checked_in', customerName: 'คุณแม่น้องมะปราง', nickname: 'น้องมะปราง', phone: '0870011004', payment: { method: 'omise_mobile_banking', status: 'paid' } },
    { queueNo: 'A005', serviceKey: 'private', resourceCode: 'T-ANN', time: '13:00', status: 'waiting', customerName: 'คุณแม่น้องพาย', nickname: 'น้องพาย', phone: '0870011005', payment: { method: 'bank_transfer', status: 'awaiting_verification' } },
    { queueNo: 'A006', serviceKey: 'trial', time: '15:00', status: 'pending_approval', customerName: 'คุณพ่อน้องไอซ์', nickname: 'น้องไอซ์', phone: '0870011006' },
  ],
  chats: [
    { role: 'customer', text: 'ลูกเรียน ม.2 อยากลองเรียนคณิตก่อน มีทดลองเรียนไหมคะ' },
    { role: 'bot', text: 'มีทดลองเรียนฟรีพร้อมวัดระดับ 45 นาทีค่ะ กด "จองคลาส" เลือก "ทดลองเรียนฟรี" แล้วเลือกวันที่สะดวก ทางบ้านติวจะยืนยันเวลาให้ใน LINE ค่ะ' },
    { role: 'customer', text: 'เสาร์นี้คลาสกลุ่ม 10 โมงเต็มหรือยัง' },
    { role: 'bot', text: 'คลาสคณิต ม.ต้น เสาร์ 10:00 เหลือ 2 ที่ค่ะ ถ้าเต็มแล้วจะขึ้นว่าเต็มในหน้าจอง' },
  ],
  promos: [
    { title: 'ซื้อคอร์ส 10 ครั้ง แถม 1 ครั้ง', subtitle: 'คลาสกลุ่มคณิตและอังกฤษ ถึงสิ้นเดือนนี้', cta: 'สอบถามคอร์ส' },
    { title: 'ติวเข้ม สอบเข้า ม.4', subtitle: 'รอบปิดเทอม รับจำกัด 8 คนต่อกลุ่ม', cta: 'จองคลาส' },
  ],
  signage: { template: 'board', theme: 'day_teal' },
  seo: {
    title: 'ทดลองระบบจองคลาสเรียน ติวเตอร์ ผ่าน LINE',
    description: 'ทดลองระบบจองคลาสเรียนพิเศษผ่าน LINE ฟรี ไม่ต้องสมัคร ผู้ปกครองเลือกคลาส ครู และเวลาเอง คลาสกลุ่มเต็มแล้วจองไม่ได้ เตือนก่อนถึงเวลาเรียนทางไลน์',
    h1: 'ทดลองระบบจองคลาสเรียนและติวเตอร์ผ่าน LINE',
    keywords: ['ระบบจองคลาสเรียน', 'ระบบจองติวเตอร์', 'จองคลาสเรียนพิเศษผ่าน LINE', 'โปรแกรมจัดตารางสอนพิเศษ', 'ระบบนัดเรียนตัวต่อตัว'],
    answer:
      'ระบบจองคลาสเรียนผ่าน LINE ให้ผู้ปกครองหรือผู้เรียนเลือกคลาสกลุ่มหรือเรียนตัวต่อตัว เลือกครูและเวลาที่ยังว่างจาก LINE OA ของสถาบัน คลาสกลุ่มรับได้ตามจำนวนที่นั่งที่ตั้งไว้ ครบแล้วขึ้นว่าเต็ม และส่งข้อความเตือนก่อนถึงเวลาเรียนได้',
    painPoints: [
      'ผู้ปกครองทักถามว่าคลาสไหนยังว่าง ต้องไล่เช็กตารางครูทุกคน',
      'คลาสกลุ่มรับเกินจำนวน เพราะจองผ่านหลายช่องทาง',
      'เด็กลืมวันเรียน ครูรอเก้อและเสียชั่วโมงสอน',
    ],
    benefits: [
      'คลาสกลุ่มนับที่นั่งต่อรอบ เต็มแล้วผู้ปกครองเห็นทันที',
      'ผูกครูกับวิชาที่สอน ผู้ปกครองเลือกครูได้เฉพาะคนที่สอนวิชานั้น',
      'ส่งข้อความเตือนก่อนเรียนตั้งแต่ 15 นาทีถึง 1 วัน',
      'ทดลองเรียนฟรีให้สถาบันยืนยันเวลาก่อนเป็นคิวจริง',
    ],
    faqs: [
      { q: 'ระบบจองคลาสเรียนผ่าน LINE จำกัดจำนวนนักเรียนต่อคลาสได้ไหม', a: 'ได้ ตั้งจำนวนที่นั่งต่อรอบของแต่ละคลาส เช่น คลาสคณิตกลุ่ม 8 คน เมื่อครบแล้วรอบนั้นขึ้นว่าเต็มและจองเพิ่มไม่ได้' },
      { q: 'ผู้ปกครองเลือกติวเตอร์ที่ต้องการเองได้ไหม', a: 'ได้ เพิ่มครูแต่ละคนและผูกกับวิชาที่สอน ผู้ปกครองเลือกครูได้เฉพาะคนที่สอนคลาสนั้น หรือเลือก "ไม่ระบุ" ให้สถาบันจัดครูให้' },
      { q: 'สถาบันกวดวิชาส่งข้อความเตือนนักเรียนก่อนเรียนได้ไหม', a: 'ได้ เปิดการแจ้งเตือนล่วงหน้าแล้วเลือกเวลาได้ตั้งแต่ 15 นาทีถึง 1 วันก่อนเรียน ข้อความส่งเข้า LINE ของคนที่จอง ถ้าไม่สะดวกกดยกเลิกจากข้อความได้' },
      { q: 'คลาสทดลองเรียนฟรีของโรงเรียนกวดวิชาให้แอดมินยืนยันก่อนได้ไหม', a: 'ได้ ตั้งบริการทดลองเรียนให้ต้องรอยืนยัน คำขอเข้าคิวรออนุมัติ แอดมินจัดครูแล้วกดยืนยัน ผู้ปกครองได้ข้อความยืนยันใน LINE' },
      { q: 'ร้านสอนพิเศษส่งข้อความชวนนักเรียนที่หายไปกลับมาเรียนได้ไหม', a: 'ได้ในแพ็กเกจ Professional ขึ้นไป ระบบดูรอบการมาเรียนของแต่ละคน ถ้าเลยกำหนดนานกว่าปกติจะส่งข้อความชวนกลับมาจองทาง LINE โดยจำกัดจำนวนข้อความต่อเดือนได้' },
    ],
  },
};
