import type { BusinessScenario } from './types';

/** Car wash / detailing shop: quick washes by bay, long coating and polishing jobs with flexible duration. */
export const carCareScenario: BusinessScenario = {
  type: 'car_care',
  slug: 'car-care',
  label: 'คาร์แคร์ ล้างรถ',
  icon: '🧽',
  shopName: 'บับเบิ้ลวอช คาร์แคร์',
  branchName: 'สาขาราชพฤกษ์',
  openTime: '08:00',
  closeTime: '19:00',
  slotMinutes: 30,
  resourceLabel: 'ช่องล้าง',
  resourcePicker: 'optional',
  services: [
    { key: 'wash-vacuum', name: 'ล้างสี ดูดฝุ่น', description: 'รถเก๋ง 250 บาท ใช้เวลาประมาณ 40 นาที', icon: '🚿', durationMinutes: 45, price: 250, bookingMode: 'fixed_slot', capacityPerSlot: 2 },
    { key: 'wash-wax', name: 'ล้าง + เคลือบแว็กซ์', description: 'แว็กซ์คาร์นูบา เงาฉ่ำ อยู่ได้ 1 เดือน', icon: '✨', durationMinutes: 90, price: 590, bookingMode: 'fixed_slot', capacityPerSlot: 1 },
    { key: 'interior', name: 'ซักเบาะ ฟอกพรม ทำความสะอาดภายใน', description: 'ขจัดคราบและกลิ่นอับ รับรถช่วงเย็น', icon: '💺', durationMinutes: 180, price: 1500, bookingMode: 'fixed_slot', capacityPerSlot: 1 },
    { key: 'polish', name: 'ขัดสีลบรอยขนแมว', description: 'เวลาขึ้นกับสภาพสี 3–5 ชั่วโมง', icon: '🪞', durationMinutes: 240, price: 2900, bookingMode: 'flexible_duration', capacityPerSlot: 1 },
    { key: 'ceramic', name: 'เคลือบแก้วเซรามิก', description: 'ทิ้งรถไว้ 1 วัน ร้านโทรยืนยันคิวและรุ่นรถก่อน', icon: '💎', durationMinutes: 480, price: 8900, bookingMode: 'request_approval', capacityPerSlot: 1 },
  ],
  resources: [
    { code: 'W1', name: 'ช่องล้าง 1', type: 'service_area', capacity: 1, serviceKeys: ['wash-vacuum', 'wash-wax'], detail: 'ล้างโฟม · แรงดันสูง' },
    { code: 'W2', name: 'ช่องล้าง 2', type: 'service_area', capacity: 1, serviceKeys: ['wash-vacuum', 'wash-wax', 'interior'], detail: 'รับรถ SUV / กระบะ 4 ประตู' },
    { code: 'DETAIL', name: 'ห้องดีเทลลิ่ง', type: 'service_area', capacity: 1, serviceKeys: ['interior', 'polish', 'ceramic'], detail: 'ห้องปิด ปลอดฝุ่น · ไฟส่องสี' },
  ],
  queues: [
    { queueNo: 'A001', serviceKey: 'wash-vacuum', resourceCode: 'W1', time: '08:30', status: 'completed', customerName: 'คุณหญิง', nickname: 'ขาว 1กง 2210', phone: '0920003301', payment: { method: 'omise_promptpay', status: 'paid' } },
    { queueNo: 'A002', serviceKey: 'ceramic', resourceCode: 'DETAIL', time: '08:30', status: 'serving', customerName: 'คุณภูมิ', nickname: 'ดำ 7ขม 905', phone: '0920003302', payment: { method: 'bank_transfer', status: 'paid' } },
    { queueNo: 'A003', serviceKey: 'wash-wax', resourceCode: 'W2', time: '09:30', status: 'called', customerName: 'คุณอ้อม', nickname: 'แดง ฆฉ 3381', phone: '0920003303', payment: { method: 'omise_promptpay', status: 'paid' } },
    { queueNo: 'A004', serviceKey: 'wash-vacuum', resourceCode: 'W1', time: '10:00', status: 'waiting', customerName: 'คุณบอส', nickname: 'เทา บย 4402', phone: '0920003304' },
    { queueNo: 'A005', serviceKey: 'interior', resourceCode: 'W2', time: '13:00', status: 'confirmed', customerName: 'คุณแตงโม', nickname: 'ขาว 2กจ 118', phone: '0920003305', payment: { method: 'omise_mobile_banking', status: 'paid' } },
    { queueNo: 'A006', serviceKey: 'ceramic', time: '08:00', status: 'pending_approval', customerName: 'คุณกฤษ', nickname: 'น้ำเงิน 9กพ 6620', phone: '0920003306', payment: { method: 'bank_transfer', status: 'pending_payment' } },
  ],
  chats: [
    { role: 'customer', text: 'ล้างรถตอนเที่ยงพรุ่งนี้ได้ไหมคะ รถ SUV' },
    { role: 'bot', text: 'พรุ่งนี้ 12:00 ช่องล้าง 2 ยังว่างค่ะ ช่องนี้รับรถ SUV กด "จองคิวล้างรถ" ที่เมนูด้านล่างได้เลย' },
    { role: 'customer', text: 'เคลือบแก้วต้องทิ้งรถไว้นานแค่ไหน' },
    { role: 'bot', text: 'เคลือบแก้วใช้เวลาประมาณ 1 วันค่ะ จองแล้วร้านจะโทรยืนยันรุ่นรถและเวลารับรถอีกครั้ง' },
  ],
  promos: [
    { title: 'ล้างรถวันธรรมดา ลด 50 บาท', subtitle: 'จองผ่าน LINE ก่อน 11:00 จันทร์–ศุกร์', cta: 'จองคิวล้างรถ' },
    { title: 'เคลือบแก้ว แถมล้างฟรี 3 ครั้ง', subtitle: 'จองภายในสิ้นเดือนนี้', cta: 'จองเคลือบแก้ว' },
  ],
  signage: { template: 'lane', theme: 'day_teal' },
  seo: {
    title: 'ทดลองระบบจองคิวคาร์แคร์ ร้านล้างรถ ผ่าน LINE',
    description: 'ทดลองระบบจองคิวคาร์แคร์ผ่าน LINE ฟรี ไม่ต้องสมัคร ลูกค้าจองล้างรถ ซักเบาะ เคลือบแก้วเองได้ เลือกช่องล้างที่ว่าง ไม่ต้องจอดรอคิวยาวหน้าร้านวันหยุด',
    h1: 'ทดลองระบบจองคิวคาร์แคร์ผ่าน LINE',
    keywords: ['ระบบจองคิวคาร์แคร์', 'ระบบจองคิวล้างรถ', 'จองคิวล้างรถผ่าน LINE', 'โปรแกรมร้านคาร์แคร์', 'จองคิวเคลือบแก้วรถยนต์'],
    answer:
      'ระบบจองคิวคาร์แคร์ผ่าน LINE ให้ลูกค้าเลือกบริการ เช่น ล้างสีดูดฝุ่น ซักเบาะ หรือเคลือบแก้ว แล้วจองเวลาที่ช่องล้างยังว่างได้เองจาก LINE OA ของร้าน ร้านเห็นว่าแต่ละช่องมีรถเข้ากี่คันตลอดวัน งานเคลือบแก้วที่ใช้เวลาทั้งวันตั้งให้ร้านยืนยันก่อนรับรถได้',
    painPoints: [
      'วันเสาร์อาทิตย์รถต่อคิวยาวจนล้นออกถนน ลูกค้าขับหนี',
      'วันธรรมดาช่องล้างว่างทั้งเช้า แต่ลูกค้าไม่รู้',
      'งานเคลือบแก้วกินเวลาทั้งวัน รับซ้อนแล้วส่งรถไม่ทัน',
    ],
    benefits: [
      'ลูกค้าจองเวลาล่วงหน้า ไม่ต้องจอดรอคิวหน้าร้าน',
      'ผูกบริการกับช่องล้างหรือห้องดีเทลลิ่ง ไม่รับงานซ้อนช่องเดียวกัน',
      'ส่งข้อความขอบคุณหลังล้างพร้อมปุ่มรีวิว Google',
      'ทักลูกค้าที่เลยรอบล้างประจำให้กลับมาจองอีกครั้ง (แพ็กเกจ Professional ขึ้นไป)',
    ],
    faqs: [
      { q: 'ระบบจองคิวคาร์แคร์ แยกช่องล้างกับห้องเคลือบแก้วได้ไหม', a: 'ได้ ตั้งแต่ละช่องล้างและห้องดีเทลลิ่งเป็นพื้นที่บริการ แล้วผูกว่าช่องไหนรับงานอะไร ช่องที่มีรถจองแล้วจะไม่เปิดให้จองซ้อนในเวลาเดียวกัน' },
      { q: 'ร้านล้างรถรับทั้งคิวจองผ่าน LINE และรถที่ขับเข้ามาเองได้ไหม', a: 'ได้ พนักงานเพิ่มคิวรถที่ขับเข้ามาเองจากหลังบ้าน แล้วเรียกคิวทั้งสองแบบจากหน้าจอเดียวกัน ลูกค้าที่จองผ่าน LINE ได้ข้อความเมื่อรถถึงคิว' },
      { q: 'งานขัดสีรถเกินเวลาที่จองไว้ ร้านคาร์แคร์ทำอย่างไร', a: 'พนักงานกดต่อเวลาให้คิวที่ผูกกับห้องดีเทลลิ่งได้ ระบบเช็คก่อนว่าช่วงถัดไปยังว่าง คิวหลังจึงไม่ทับกัน' },
      { q: 'ร้านคาร์แคร์ส่งข้อความชวนลูกค้ากลับมาล้างรถอีกได้ไหม', a: 'ได้ หลังล้างเสร็จระบบส่งข้อความขอบคุณพร้อมปุ่มรีวิว Google ได้ และแพ็กเกจ Professional ขึ้นไปส่งข้อความชวนลูกค้าที่เลยรอบมาประจำให้กลับมาจองอีกครั้ง' },
      { q: 'จอทีวีหน้าร้านคาร์แคร์บอกลูกค้าว่ารถคันไหนเสร็จแล้วได้ไหม', a: 'ได้ เปิดจอคิวจากเบราว์เซอร์ของทีวีเครื่องไหนก็ได้ ถ้าลูกค้าใส่ชื่อเล่นเป็นรุ่นรถหรือทะเบียน จอจะแสดงชื่อนั้น คนนั่งรอจึงรู้ว่ารถคันไหนกำลังล้างและคันไหนถูกเรียกรับรถ' },
    ],
  },
};
