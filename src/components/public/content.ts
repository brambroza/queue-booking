import type { SvgIconComponent } from '@mui/icons-material';
import ContentCutRoundedIcon from '@mui/icons-material/ContentCutRounded';
import LocalHospitalRoundedIcon from '@mui/icons-material/LocalHospitalRounded';
import BackHandRoundedIcon from '@mui/icons-material/BackHandRounded';
import PhoneIphoneRoundedIcon from '@mui/icons-material/PhoneIphoneRounded';
import DirectionsCarFilledRoundedIcon from '@mui/icons-material/DirectionsCarFilledRounded';
import RestaurantRoundedIcon from '@mui/icons-material/RestaurantRounded';
import ApartmentRoundedIcon from '@mui/icons-material/ApartmentRounded';
import AccountBalanceRoundedIcon from '@mui/icons-material/AccountBalanceRounded';
import HealingRoundedIcon from '@mui/icons-material/HealingRounded';
import WorkspacesRoundedIcon from '@mui/icons-material/WorkspacesRounded';
import BuildRoundedIcon from '@mui/icons-material/BuildRounded';

export type UseCase = {
  icon: SvgIconComponent;
  title: string;
  services: string[];
  mode: string;
};

export const painPoints = [
  'ลูกค้าทักถามคิวซ้ำ ๆ',
  'พนักงานตอบแชทไม่ทัน',
  'คิวชนกันหรือจองซ้ำ',
  'จัดการหลายสาขายาก',
  'ไม่มีรายงานจำนวนคิว',
  'ลูกค้าลืมนัดหรือไม่มาตามนัด',
];

export const solutions = [
  'ลูกค้าถามคิวว่างผ่าน LINE',
  'จองคิวผ่าน LIFF',
  'ระบบตอบกลับอัตโนมัติ',
  'จัดการคิวหลังบ้าน',
  'รองรับหลายร้าน หลายสาขา',
  'รองรับคิวแบบ Fix เวลา และไม่ Fix เวลา',
  'ดูรายงานและสถิติได้',
];

export const features = [
  'LINE OA Booking',
  'LIFF Booking Page',
  'Auto Reply',
  'Booking Management',
  'Service Management',
  'Working Hours',
  'Multi-branch',
  'Staff Management',
  'Chat Inbox',
  'Calendar View',
  'Queue Board',
  'Reports',
  'Notification',
];

export const useCases: UseCase[] = [
  { icon: ContentCutRoundedIcon, title: 'ร้านตัดผม', services: ['ตัดผมชาย: fixed_slot 30 นาที', 'ทำสีผม: flexible_duration 90-180 นาที'], mode: 'fixed_slot / flexible_duration' },
  { icon: LocalHospitalRoundedIcon, title: 'คลินิก', services: ['ตรวจทั่วไป: fixed_slot 15 นาที', 'พบแพทย์เฉพาะทาง: request_approval'], mode: 'fixed_slot / request_approval' },
  { icon: BackHandRoundedIcon, title: 'ร้านทำเล็บ', services: ['ทำเล็บเจล', 'ต่อเล็บ'], mode: 'fixed_slot' },
  { icon: PhoneIphoneRoundedIcon, title: 'ร้านซ่อมมือถือ', services: ['เช็คอาการเครื่อง', 'ซ่อมด่วน'], mode: 'request_approval' },
  { icon: DirectionsCarFilledRoundedIcon, title: 'ร้านซ่อมรถ', services: ['เปลี่ยนยางรถ', 'เช็คระยะ'], mode: 'request_approval' },
  { icon: RestaurantRoundedIcon, title: 'ร้านอาหาร', services: ['จองโต๊ะ: capacity_based', 'Walk-in: walk_in'], mode: 'capacity_based / walk_in' },
  { icon: ApartmentRoundedIcon, title: 'ศูนย์บริการ', services: ['รับเรื่องบริการ', 'รับคิวหน้างาน'], mode: 'fixed_slot' },
  { icon: AccountBalanceRoundedIcon, title: 'งานราชการ', services: ['ติดต่อราชการ', 'ยื่นเอกสาร'], mode: 'request_approval' },
  { icon: HealingRoundedIcon, title: 'โรงพยาบาล', services: ['ตรวจทั่วไป', 'เฉพาะทาง'], mode: 'fixed_slot / request_approval' },
  { icon: WorkspacesRoundedIcon, title: 'Consult', services: ['ปรึกษาธุรกิจ', 'วางแผนโครงการ'], mode: 'flexible_duration' },
  { icon: BuildRoundedIcon, title: 'ทีมช่างติดตั้ง', services: ['ติดตั้งกล้องวงจรปิด: request_approval', 'ตรวจหน้างาน: flexible_duration'], mode: 'request_approval / flexible_duration' },
];

export const pricingPlans = [
  { name: 'Starter', price: '590', desc: 'เหมาะกับร้านเริ่มต้น', items: ['1 ร้าน', '1 สาขา', '3 บริการ', '300 bookings/เดือน', 'LINE Booking', 'Dashboard พื้นฐาน'] },
  { name: 'Professional', price: '1,490', desc: 'สำหรับร้านที่เติบโต', items: ['1 ร้าน', '5 สาขา', 'ไม่จำกัดบริการ', '2,000 bookings/เดือน', 'LINE Auto Reply', 'Calendar / Queue Board', 'Reports'], highlight: true },
  { name: 'Business', price: '3,990', desc: 'หลายสาขาและทีมใหญ่', items: ['หลายร้าน / หลายสาขา', 'ไม่จำกัดบริการ', '10,000 bookings/เดือน', 'Chat Inbox', 'Advanced Reports', 'Priority Support'] },
];

export const testimonials = [
  { name: 'Narin Barber', type: 'ร้านตัดผม', quote: 'ลูกค้าจองคิวผ่าน LINE ได้เลย ลดเวลาตอบแชทหน้าร้านลงชัดเจน' },
  { name: 'Care Plus Clinic', type: 'คลินิก', quote: 'จัดการแพทย์และคิวคนไข้ได้ง่ายขึ้น ทั้งแบบนัดและขออนุมัติ' },
  { name: 'Service Hub Center', type: 'ศูนย์บริการ', quote: 'พนักงานเห็นคิวเรียลไทม์ทุกสาขา และรายงานช่วยวางกำลังคนได้ดี' },
];

export const featureCompare = [
  { key: 'จำนวนสาขา', trial: '1', starter: '1', pro: '5', business: 'ไม่จำกัด', enterprise: 'Custom' },
  { key: 'จำนวนบริการ', trial: '1', starter: '3', pro: 'ไม่จำกัด', business: 'ไม่จำกัด', enterprise: 'ไม่จำกัด' },
  { key: 'Bookings / เดือน', trial: '50', starter: '300', pro: '2,000', business: '10,000', enterprise: 'Custom' },
  { key: 'LINE Auto Reply', trial: '-', starter: '-', pro: '✓', business: '✓', enterprise: '✓' },
  { key: 'Chat Inbox', trial: '-', starter: '-', pro: '-', business: '✓', enterprise: '✓' },
  { key: 'SLA / Dedicated Support', trial: '-', starter: '-', pro: '-', business: '-', enterprise: '✓' },
];

export const faqs = [
  { q: 'ต้องมี LINE OA ก่อนใช้งานไหม?', a: 'แนะนำให้มี LINE OA เพื่อให้ลูกค้าจองผ่านแชทได้ทันที' },
  { q: 'รองรับหลายสาขาหรือไม่?', a: 'รองรับหลายสาขา และแยกการจัดการคิวตามสาขาได้' },
  { q: 'เริ่มใช้งานใช้เวลานานไหม?', a: 'สามารถเริ่มใช้งานจริงได้ภายในไม่กี่นาทีหลังตั้งค่าเสร็จ' },
];
