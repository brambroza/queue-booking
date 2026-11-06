import type { BusinessScenario } from './types';

/** Neighbourhood medical clinic: short doctor visits, vaccine rounds, check-up packages confirmed by the clinic. */
export const clinicScenario: BusinessScenario = {
  type: 'clinic',
  slug: 'clinic',
  label: 'คลินิก',
  icon: '🩺',
  shopName: 'คลินิกเวชกรรมหมอใจดี',
  branchName: 'สาขาบางนา-ตราด กม.3',
  openTime: '08:00',
  closeTime: '20:00',
  slotMinutes: 15,
  resourceLabel: 'แพทย์',
  resourcePicker: 'optional',
  services: [
    { key: 'general', name: 'ตรวจโรคทั่วไป', description: 'ไข้หวัด ปวดหัว ท้องเสีย ชำระค่ารักษาที่คลินิก', icon: '🩺', durationMinutes: 15, price: 0, bookingMode: 'fixed_slot', capacityPerSlot: 1 },
    { key: 'flu-vaccine', name: 'ฉีดวัคซีนไข้หวัดใหญ่', description: 'วัคซีน 4 สายพันธุ์ รอบละ 4 ท่าน', icon: '💉', durationMinutes: 15, price: 690, bookingMode: 'capacity_based', capacityPerSlot: 4 },
    { key: 'checkup', name: 'ตรวจสุขภาพประจำปี', description: 'ต้องงดอาหาร คลินิกยืนยันวันและแจ้งการเตรียมตัว', icon: '📋', durationMinutes: 60, price: 1900, bookingMode: 'request_approval', capacityPerSlot: 1 },
    { key: 'wound', name: 'ทำแผล / ฉีดยาตามนัด', description: 'รับบัตรคิวหน้าคลินิก ไม่ต้องนัดเวลา', icon: '🩹', durationMinutes: 10, price: 0, bookingMode: 'walk_in', capacityPerSlot: 3 },
  ],
  resources: [
    { code: 'DR-TANA', name: 'นพ.ธนา', type: 'trainer', capacity: 1, serviceKeys: ['general', 'checkup'], detail: 'แพทย์เวชปฏิบัติทั่วไป' },
    { code: 'DR-PIYA', name: 'พญ.ปิยะดา', type: 'trainer', capacity: 1, serviceKeys: ['general', 'checkup'], detail: 'แพทย์เวชศาสตร์ครอบครัว ตรวจเด็กได้' },
    { code: 'NURSE', name: 'ห้องหัตถการ', type: 'service_area', capacity: 1, serviceKeys: ['flu-vaccine', 'wound'], detail: 'พยาบาลประจำ ฉีดยา ทำแผล' },
  ],
  queues: [
    { queueNo: 'A001', serviceKey: 'general', resourceCode: 'DR-TANA', time: '08:15', status: 'completed', customerName: 'คุณสมศรี', phone: '0860005001' },
    { queueNo: 'A002', serviceKey: 'general', resourceCode: 'DR-PIYA', time: '09:00', status: 'serving', customerName: 'ด.ญ.ใบเตย', phone: '0860005002' },
    { queueNo: 'A003', serviceKey: 'flu-vaccine', resourceCode: 'NURSE', time: '09:00', status: 'called', customerName: 'คุณประเสริฐ', phone: '0860005003', payment: { method: 'omise_promptpay', status: 'paid' } },
    { queueNo: 'A004', serviceKey: 'general', time: '09:15', status: 'waiting', customerName: 'คุณวรรณา', phone: '0860005004' },
    { queueNo: 'A005', serviceKey: 'wound', time: '09:20', status: 'waiting', customerName: 'คุณบุญมี', phone: '0860005005' },
    { queueNo: 'A006', serviceKey: 'flu-vaccine', time: '10:00', status: 'checked_in', customerName: 'คุณจันทร์เพ็ญ', phone: '0860005006', payment: { method: 'bank_transfer', status: 'paid' } },
    { queueNo: 'A007', serviceKey: 'checkup', resourceCode: 'DR-TANA', time: '08:00', status: 'pending_approval', customerName: 'คุณอนุชา', phone: '0860005007', payment: { method: 'bank_transfer', status: 'awaiting_verification' } },
  ],
  chats: [
    { role: 'customer', text: 'วันนี้หมอปิยะดาเข้าไหมคะ ลูกเป็นไข้' },
    { role: 'bot', text: 'วันนี้พญ.ปิยะดาออกตรวจ 08:00–14:00 ค่ะ ยังว่าง 10:30 และ 11:15 กด "จองคิว" ที่เมนูด้านล่างได้เลย' },
    { role: 'customer', text: 'ตรวจสุขภาพต้องเตรียมตัวไหม' },
    { role: 'bot', text: 'ต้องงดน้ำและอาหาร 8 ชั่วโมงค่ะ ส่งคำขอจองตรวจสุขภาพไว้ได้เลย คลินิกจะยืนยันวันและแจ้งรายละเอียดทาง LINE' },
  ],
  promos: [
    { title: 'วัคซีนไข้หวัดใหญ่ 690 บาท', subtitle: 'จองรอบล่วงหน้า ไม่ต้องรอคิวหน้าคลินิก', cta: 'จองรอบฉีด' },
    { title: 'ตรวจสุขภาพก่อนเข้างาน', subtitle: 'รับใบรับรองแพทย์ภายในวันเดียว', cta: 'ส่งคำขอจอง' },
  ],
  signage: { template: 'counter', theme: 'clinic' },
  seo: {
    title: 'ทดลองระบบจองคิวคลินิก นัดพบแพทย์ ผ่าน LINE',
    description: 'ทดลองระบบจองคิวคลินิกผ่าน LINE ฟรี ไม่ต้องสมัคร คนไข้เลือกแพทย์และเวลาว่างเอง ฉีดวัคซีนจองเป็นรอบ เรียกคิวแล้วคนไข้ได้ LINE แจ้งทันที',
    h1: 'ทดลองระบบจองคิวคลินิกผ่าน LINE',
    keywords: ['ระบบจองคิวคลินิก', 'ระบบนัดหมายคลินิก', 'จองคิวหมอผ่าน LINE', 'โปรแกรมจองคิวคลินิก', 'ระบบเรียกคิวคลินิก', 'บัตรคิวออนไลน์คลินิก'],
    answer:
      'ระบบจองคิวคลินิกผ่าน LINE ให้คนไข้เปิด LINE OA ของคลินิก เลือกบริการ เลือกแพทย์หรือไม่ระบุ แล้วเลือกเวลาที่ยังว่างได้เอง โดยไม่ต้องโหลดแอป คลินิกตั้งได้ทั้งคิวตรวจตามเวลา คิวฉีดวัคซีนเป็นรอบ และคิวตรวจสุขภาพที่ต้องยืนยันก่อน เมื่อเจ้าหน้าที่เรียกคิว คนไข้ได้ข้อความใน LINE และเห็นเลขคิวบนจอทีวี',
    painPoints: [
      'คนไข้มารอหน้าคลินิกตั้งแต่เช้า ห้องรอแน่นทั้งที่หมอยังไม่ออกตรวจ',
      'โทรศัพท์ดังทั้งวันเพราะคนไข้โทรถามว่าหมอเข้ากี่โมง',
      'คนไข้ออกไปรอข้างนอกแล้วพลาดตอนเรียกชื่อ',
    ],
    benefits: [
      'คนไข้จองเวลาตรวจเองใน LINE มาถึงตรงเวลา ห้องรอไม่แออัด',
      'กด "ฉันมาถึงแล้ว" จาก LINE ได้ เจ้าหน้าที่รู้ว่าใครถึงคลินิกแล้ว',
      'เรียกคิวแล้วคนไข้ได้ข้อความ LINE ทันที ไปรอข้างนอกก็ไม่พลาดคิว',
      'จอทีวีเรียกคิวเปิดในเบราว์เซอร์ใดก็ได้ ไม่ต้องซื้อเครื่องกดบัตรคิว',
    ],
    faqs: [
      { q: 'ระบบจองคิวคลินิกผ่าน LINE คนไข้สูงอายุใช้ยากไหม', a: 'ใช้ไม่ยาก คนไข้กดเมนูใน LINE ที่ใช้อยู่ทุกวัน เลือกบริการและเวลา แล้วกดยืนยัน ไม่ต้องโหลดแอปหรือสมัครสมาชิกเพิ่ม ส่วนคนที่จองเองไม่ได้ เจ้าหน้าที่ลงคิวให้จากหลังบ้านได้' },
      { q: 'คลินิกเรียกคิวแล้วแจ้งคนไข้ทาง LINE ได้ไหม', a: 'ได้ เมื่อเจ้าหน้าที่กดเรียกคิว คนไข้ได้ข้อความ "ถึงคิวของคุณแล้ว" ใน LINE ทันที และเลขคิวขึ้นบนจอทีวีในห้องรอพร้อมกัน' },
      { q: 'คลินิกตั้งรอบฉีดวัคซีนให้รับได้รอบละหลายคนได้ไหม', a: 'ได้ ตั้งบริการฉีดวัคซีนเป็นแบบรับจำนวนต่อรอบ เช่น รอบละ 4 คน พอครบรอบนั้นจะขึ้นว่าเต็ม คนไข้เลือกรอบถัดไปได้' },
      { q: 'คลินิกที่มีแพทย์หลายคนเข้าเวรไม่ตรงกัน จัดคิวแยกแพทย์ได้ไหม', a: 'ได้ คนไข้เลือกแพทย์ตอนจองหรือเลือก "ไม่ระบุ" ระบบโชว์เฉพาะเวลาที่แพทย์คนนั้นยังว่าง และซิงก์นัดเข้า Google Calendar ให้แพทย์ดูตารางจากมือถือได้' },
      { q: 'คลินิกจำกัดให้คนไข้จองได้วันละคิวเดียวได้ไหม', a: 'ได้ เปิดสวิตช์จำกัดหนึ่งคิวต่อวัน คนไข้ที่จองผ่าน LINE จะจองซ้ำในวันเดียวกันไม่ได้ ส่วนเจ้าหน้าที่ยังลงคิวเพิ่มให้ได้จากหลังบ้าน' },
      { q: 'คลินิกเปิดให้คนไข้จองล่วงหน้าได้แค่ 7 วันได้ไหม', a: 'ได้ ตั้งระยะจองล่วงหน้าต่อสาขาได้ เช่น 1 สัปดาห์หรือ 1 เดือน ปฏิทินใน LINE จะโชว์เฉพาะวันที่จองได้' },
    ],
    useCaseSlug: 'clinic',
    solutionPath: '/solutions/clinic-booking-system',
  },
};
