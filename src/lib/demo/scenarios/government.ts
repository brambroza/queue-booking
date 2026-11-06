import type { BusinessScenario } from './types';

/** Local government office: walk-in counter queues plus fixed appointments, most services free, a few fees. */
export const governmentScenario: BusinessScenario = {
  type: 'government',
  slug: 'government-office',
  label: 'หน่วยงานราชการ',
  icon: '🏛️',
  shopName: 'สำนักงานเทศบาลเมืองศรีวารินทร์',
  branchName: 'อาคารบริการประชาชน ชั้น 1',
  openTime: '08:30',
  closeTime: '16:30',
  slotMinutes: 15,
  resourceLabel: 'ช่องบริการ',
  resourcePicker: 'optional',
  services: [
    { key: 'civil-registry', name: 'งานทะเบียนราษฎร', description: 'แจ้งย้ายที่อยู่ แจ้งเกิด คัดสำเนาทะเบียนบ้าน', icon: '🪪', durationMinutes: 15, price: 0, bookingMode: 'fixed_slot', capacityPerSlot: 2 },
    { key: 'land-tax', name: 'ชำระภาษีที่ดินและสิ่งปลูกสร้าง', description: 'นำใบแจ้งประเมินภาษีมาด้วย รับคิวหน้าช่องได้', icon: '🧾', durationMinutes: 10, price: 0, bookingMode: 'walk_in', capacityPerSlot: 4 },
    { key: 'building-permit', name: 'ยื่นขออนุญาตก่อสร้าง / ต่อเติม', description: 'นัดล่วงหน้า เจ้าหน้าที่กองช่างตรวจเอกสารกับท่าน', icon: '🏗️', durationMinutes: 30, price: 0, bookingMode: 'fixed_slot', capacityPerSlot: 1 },
    { key: 'site-inspection', name: 'นัดเจ้าหน้าที่ตรวจสถานที่', description: 'ขอใบอนุญาตประกอบกิจการ เจ้าหน้าที่ยืนยันวันนัด', icon: '📍', durationMinutes: 60, price: 0, bookingMode: 'request_approval', capacityPerSlot: 1 },
    { key: 'document-copy', name: 'ขอสำเนาเอกสารรับรอง', description: 'ค่าธรรมเนียมรับรองสำเนาชุดละ 20 บาท', icon: '📄', durationMinutes: 10, price: 20, bookingMode: 'walk_in', capacityPerSlot: 3 },
  ],
  resources: [
    { code: 'CT1', name: 'ช่องบริการ 1', type: 'counter', capacity: 1, serviceKeys: ['civil-registry'], detail: 'งานทะเบียนราษฎร' },
    { code: 'CT2', name: 'ช่องบริการ 2', type: 'counter', capacity: 1, serviceKeys: ['civil-registry', 'document-copy'], detail: 'ทะเบียนราษฎร · รับรองสำเนา' },
    { code: 'CT3', name: 'ช่องบริการ 3', type: 'counter', capacity: 1, serviceKeys: ['land-tax'], detail: 'กองคลัง · รับชำระภาษี' },
    { code: 'CT4', name: 'ช่องบริการ 4', type: 'counter', capacity: 1, serviceKeys: ['building-permit', 'site-inspection'], detail: 'กองช่าง · ใบอนุญาต' },
  ],
  queues: [
    { queueNo: 'A001', serviceKey: 'civil-registry', resourceCode: 'CT1', time: '08:30', status: 'completed', customerName: 'นายสมพงษ์ ใจดี', phone: '0820001101' },
    { queueNo: 'A002', serviceKey: 'land-tax', resourceCode: 'CT3', time: '08:45', status: 'completed', customerName: 'นางบุญเรือน แก้วมา', phone: '0820001102' },
    { queueNo: 'A003', serviceKey: 'civil-registry', resourceCode: 'CT2', time: '09:00', status: 'serving', customerName: 'นางสาวกมลวรรณ ศรีสุข', phone: '0820001103' },
    { queueNo: 'A004', serviceKey: 'land-tax', resourceCode: 'CT3', time: '09:00', status: 'called', customerName: 'นายประยูร ทองดี', phone: '0820001104' },
    { queueNo: 'A005', serviceKey: 'document-copy', resourceCode: 'CT2', time: '09:15', status: 'waiting', customerName: 'นายธีรวัฒน์ มั่นคง', phone: '0820001105', payment: { method: 'omise_promptpay', status: 'paid' } },
    { queueNo: 'A006', serviceKey: 'building-permit', resourceCode: 'CT4', time: '10:00', status: 'checked_in', customerName: 'นางวิไล พรหมมา', phone: '0820001106' },
    { queueNo: 'A007', serviceKey: 'site-inspection', resourceCode: 'CT4', time: '13:30', status: 'pending_approval', customerName: 'ร้านกาแฟบ้านสวน', phone: '0820001107' },
  ],
  chats: [
    { role: 'customer', text: 'แจ้งย้ายที่อยู่ต้องเตรียมเอกสารอะไรบ้างคะ' },
    { role: 'bot', text: 'เตรียมบัตรประชาชนและทะเบียนบ้านฉบับจริงค่ะ กด "จองคิว" เลือกงานทะเบียนราษฎร แล้วเลือกเวลาที่สะดวกได้เลย' },
    { role: 'customer', text: 'ถ้าไม่ได้จองมาก่อน มาติดต่อได้ไหม' },
    { role: 'bot', text: 'ได้ค่ะ งานชำระภาษีรับคิวหน้าช่องบริการได้ตามปกติ ผู้ที่จองผ่าน LINE จะได้รับข้อความเมื่อถึงคิว' },
  ],
  promos: [
    { title: 'เปิดให้บริการวันเสาร์', subtitle: 'งานทะเบียนราษฎร เสาร์แรกของเดือน 08:30–12:00', cta: 'จองคิว' },
    { title: 'ชำระภาษีที่ดิน ภายใน 30 เมษายน', subtitle: 'จองคิวล่วงหน้า ไม่ต้องรอนานช่วงใกล้ครบกำหนด', cta: 'จองคิวชำระภาษี' },
  ],
  signage: { template: 'counter', theme: 'day_indigo' },
  seo: {
    title: 'ทดลองระบบจองคิวหน่วยงานราชการ เทศบาล ผ่าน LINE',
    description: 'ทดลองระบบจองคิวหน่วยงานราชการผ่าน LINE ฟรี ไม่ต้องสมัคร ประชาชนจองคิวล่วงหน้าหรือรับคิวหน้าช่องบริการ เรียกคิวขึ้นจอทีวีและแจ้งเตือนใน LINE ลดความแออัด',
    h1: 'ทดลองระบบจองคิวหน่วยงานราชการผ่าน LINE',
    keywords: ['ระบบจองคิวหน่วยงานราชการ', 'ระบบคิวเทศบาล', 'จองคิวติดต่อราชการผ่าน LINE', 'ระบบเรียกคิวช่องบริการ', 'ระบบคิว อบต.'],
    answer:
      'ระบบจองคิวหน่วยงานราชการผ่าน LINE ให้ประชาชนเลือกประเภทงาน เช่น ทะเบียนราษฎรหรือยื่นขออนุญาตก่อสร้าง แล้วจองเวลาล่วงหน้าจาก LINE OA ของหน่วยงานโดยไม่ต้องโหลดแอป งานที่รับคิวหน้าช่องบริการก็อยู่ในระบบเดียวกัน เจ้าหน้าที่เรียกคิวแล้วหมายเลขขึ้นจอทีวีพร้อมส่งข้อความแจ้งใน LINE',
    painPoints: [
      'ประชาชนมารอตั้งแต่เช้า ห้องโถงแออัดช่วงใกล้ครบกำหนดชำระภาษี',
      'เดินทางมาแล้วเอกสารไม่ครบหรือเจ้าหน้าที่กองช่างไม่อยู่',
      'ไม่รู้ว่าถึงคิวเมื่อไร ต้องนั่งเฝ้าหน้าช่องบริการ',
    ],
    benefits: [
      'จองคิวล่วงหน้าแยกตามประเภทงานและช่องบริการ',
      'รับคิวหน้าช่องบริการกับคิวจองล่วงหน้าเรียกจากหลังบ้านเดียวกัน',
      'จอทีวีเรียกคิวแบบช่องบริการ เปิดได้จากเบราว์เซอร์ทุกเครื่อง',
      'งานตรวจสถานที่ให้เจ้าหน้าที่ยืนยันวันนัดก่อน',
    ],
    faqs: [
      { q: 'ระบบจองคิวหน่วยงานราชการ ประชาชนต้องโหลดแอปหรือสมัครสมาชิกไหม', a: 'ไม่ต้อง ประชาชนเพิ่มเพื่อน LINE OA ของหน่วยงานแล้วกดจองคิวได้เลย หน้าจองเปิดในแอป LINE ที่ใช้อยู่แล้ว' },
      { q: 'สำนักงานเทศบาลรับทั้งคิวจองล่วงหน้าและคิวหน้าช่องบริการพร้อมกันได้ไหม', a: 'ได้ ตั้งงานที่ต้องนัด เช่น ยื่นขออนุญาตก่อสร้าง เป็นแบบจองเวลา และตั้งงานอย่างชำระภาษีเป็นแบบรับคิวหน้าช่อง เจ้าหน้าที่เรียกทุกคิวจากหน้าจอเดียวกัน' },
      { q: 'จอเรียกคิวหน่วยงานราชการแสดงหมายเลขช่องบริการได้ไหม', a: 'ได้ เลือกรูปแบบจอแบบช่องบริการ เปิดจากเบราว์เซอร์ของทีวีเครื่องไหนก็ได้ เมื่อเจ้าหน้าที่เรียกคิว หมายเลขคิวและช่องจะขึ้นจอ และผู้ที่จองผ่าน LINE ได้ข้อความแจ้งด้วย' },
      { q: 'หน่วยงานราชการเก็บค่าธรรมเนียมผ่านระบบจองคิวได้ไหม', a: 'ได้ แต่ไม่บังคับ งานที่ไม่มีค่าธรรมเนียมตั้งราคาเป็น 0 ส่วนงานอย่างรับรองสำเนาตั้งราคาแล้วเปิดรับชำระผ่าน PromptPay หรือโอนแนบสลิปได้' },
      { q: 'จำกัดให้ประชาชนจองคิวราชการได้วันละครั้งได้ไหม', a: 'ได้ เปิดตัวเลือกจองได้วันละ 1 คิวต่อคน และกำหนดได้ว่าเปิดให้จองล่วงหน้าไม่เกินกี่วัน หรือเปิดเฉพาะวันที่กำหนด เช่น วันเสาร์ที่เปิดบริการพิเศษ' },
    ],
    useCaseSlug: 'government',
  },
};
