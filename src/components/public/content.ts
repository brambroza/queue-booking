import type { SvgIconComponent } from '@mui/icons-material';
import ContentCutRoundedIcon from '@mui/icons-material/ContentCutRounded';
import LocalHospitalRoundedIcon from '@mui/icons-material/LocalHospitalRounded';
import BackHandRoundedIcon from '@mui/icons-material/BackHandRounded';
import PhoneIphoneRoundedIcon from '@mui/icons-material/PhoneIphoneRounded';
import DirectionsCarFilledRoundedIcon from '@mui/icons-material/DirectionsCarFilledRounded';
import RestaurantRoundedIcon from '@mui/icons-material/RestaurantRounded';
import ApartmentRoundedIcon from '@mui/icons-material/ApartmentRounded';
import MeetingRoomRoundedIcon from '@mui/icons-material/MeetingRoomRounded';
import AccountBalanceRoundedIcon from '@mui/icons-material/AccountBalanceRounded';
import HealingRoundedIcon from '@mui/icons-material/HealingRounded';
import WorkspacesRoundedIcon from '@mui/icons-material/WorkspacesRounded';
import BuildRoundedIcon from '@mui/icons-material/BuildRounded';

export type UseCase = {
  icon: SvgIconComponent;
  slug: string;
  title: string;
  services: string[];
  mode: string;
  summary: string;
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
  { icon: ContentCutRoundedIcon, slug: 'barber-shop', title: 'ร้านตัดผม', services: ['ตัดผมชาย: จองตามเวลาที่แน่นอน 30 นาที', 'ทำสีผม: เวลายืดหยุ่น 90-180 นาที'], mode: 'จองตามเวลาที่แน่นอน / เวลายืดหยุ่น', summary: 'เหมาะกับร้านที่มีทั้งงานเร็วและงานใช้เวลานาน ต้องการจัดคิวไม่ชนกัน' },
  { icon: LocalHospitalRoundedIcon, slug: 'clinic', title: 'คลินิก', services: ['ตรวจทั่วไป: จองตามเวลาที่แน่นอน 15 นาที', 'พบแพทย์เฉพาะทาง: ต้องยืนยันก่อน'], mode: 'จองตามเวลาที่แน่นอน / ต้องยืนยันก่อน', summary: 'จัดคิวตรวจทั่วไปและเคสเฉพาะทางที่ต้องอนุมัติจากทีมแพทย์' },
  { icon: BackHandRoundedIcon, slug: 'nail-salon', title: 'ร้านทำเล็บ', services: ['ทำเล็บเจล', 'ต่อเล็บ'], mode: 'จองตามเวลาที่แน่นอน', summary: 'ล็อกช่วงเวลาต่อคิวชัดเจน ลดคิวซ้อนในชั่วโมงพีค' },
  { icon: PhoneIphoneRoundedIcon, slug: 'mobile-repair', title: 'ร้านซ่อมมือถือ', services: ['เช็คอาการเครื่อง', 'ซ่อมด่วน'], mode: 'ต้องยืนยันก่อน', summary: 'รับคิวตรวจอาการก่อนซ่อมจริง และให้พนักงานยืนยันงานซ่อม' },
  { icon: DirectionsCarFilledRoundedIcon, slug: 'car-service', title: 'ร้านซ่อมรถ', services: ['เปลี่ยนยางรถ', 'เช็คระยะ'], mode: 'ต้องยืนยันก่อน', summary: 'จัดคิวงานบริการที่ต้องเช็คช่างว่างและอะไหล่ก่อนยืนยัน' },
  { icon: RestaurantRoundedIcon, slug: 'restaurant', title: 'ร้านอาหาร', services: ['จองโต๊ะ: รับจำนวนต่อรอบ', 'Walk-in: เข้ารับบริการหน้าร้าน'], mode: 'รับจำนวนต่อรอบ / Walk-in', summary: 'รองรับจองโต๊ะตามความจุและคิว walk-in หน้าร้านพร้อมกัน' },
  { icon: RestaurantRoundedIcon, slug: 'buffet', title: 'ร้านบุฟเฟ่ต์', services: ['จองรอบบุฟเฟ่ต์: รับจำนวนต่อรอบ', 'คิวหน้าร้านบุฟเฟ่ต์: Walk-in'], mode: 'รับจำนวนต่อรอบ / Walk-in', summary: 'รองรับการจองรอบเวลาและคิวหน้าร้าน พร้อมควบคุมจำนวนที่นั่งต่อรอบ' },
  { icon: MeetingRoomRoundedIcon, slug: 'meeting-room', title: 'ห้องประชุม', services: ['จองห้องประชุมรายชั่วโมง', 'จองครึ่งวัน / เต็มวัน'], mode: 'จองตามเวลาที่แน่นอน', summary: 'เหมาะกับองค์กรและ coworking ที่ต้องจัดการห้องประชุมหลายห้องหลายช่วงเวลา' },
  { icon: ApartmentRoundedIcon, slug: 'service-center', title: 'ศูนย์บริการ', services: ['รับเรื่องบริการ', 'รับคิวหน้างาน'], mode: 'จองตามเวลาที่แน่นอน', summary: 'บริหารคิวบริการหลายประเภทด้วยแดชบอร์ดเดียว' },
  { icon: AccountBalanceRoundedIcon, slug: 'government', title: 'งานราชการ', services: ['ติดต่อราชการ', 'ยื่นเอกสาร'], mode: 'ต้องยืนยันก่อน', summary: 'ลดความแออัดหน้าเคาน์เตอร์และจัดคิวตามประเภทงาน' },
  { icon: HealingRoundedIcon, slug: 'hospital', title: 'โรงพยาบาล', services: ['ตรวจทั่วไป', 'เฉพาะทาง'], mode: 'จองตามเวลาที่แน่นอน / ต้องยืนยันก่อน', summary: 'รองรับคิว OPD ทั่วไปและคิวนัดเฉพาะทางที่ต้องยืนยัน' },
  { icon: WorkspacesRoundedIcon, slug: 'consulting', title: 'Consult', services: ['ปรึกษาธุรกิจ', 'วางแผนโครงการ'], mode: 'เวลายืดหยุ่น', summary: 'กำหนดเวลานัดแบบยืดหยุ่นตามความซับซ้อนของเคส' },
  { icon: BuildRoundedIcon, slug: 'installation-team', title: 'ทีมช่างติดตั้ง', services: ['ติดตั้งกล้องวงจรปิด: ต้องยืนยันก่อน', 'ตรวจหน้างาน: เวลายืดหยุ่น'], mode: 'ต้องยืนยันก่อน / เวลายืดหยุ่น', summary: 'จัดคิวตรวจหน้างานและคิวติดตั้งจริงแบบยืดหยุ่น' },
];

export const pricingPlans = [
  { name: 'Starter', price: 'ฟรี 3 เดือน', desc: 'โปรโมชันสำหรับร้านเริ่มต้น', items: ['1 ร้าน', '1 สาขา', '3 บริการ', '100 bookings/เดือน', 'LINE Booking', 'Dashboard พื้นฐาน'] },
  { name: 'Professional', price: '1,490', desc: 'สำหรับร้านที่เติบโต', items: ['1 ร้าน', '5 สาขา', 'ไม่จำกัดบริการ', '2,000 bookings/เดือน', 'LINE Auto Reply', 'Calendar / Queue Board', 'Reports'], highlight: true },
  { name: 'Business', price: '3,990', desc: 'หลายสาขาและทีมใหญ่', items: ['หลายร้าน / หลายสาขา', 'ไม่จำกัดบริการ', '10,000 bookings/เดือน', 'Chat Inbox', 'Advanced Reports', 'Priority Support'] },
  { name: 'Custom', price: 'Custom', desc: 'แพ็กเกจเฉพาะองค์กร', items: ['กำหนดเงื่อนไขได้ตามธุรกิจ', 'รองรับสาขาและทรัพยากรจำนวนมาก', 'SLA / Dedicated support', 'เชื่อมต่อระบบภายในองค์กร'] },
];

export const testimonials = [
  { name: 'Narin Barber', type: 'ร้านตัดผม', quote: 'ลูกค้าจองคิวผ่าน LINE ได้เลย ลดเวลาตอบแชทหน้าร้านลงชัดเจน' },
  { name: 'Care Plus Clinic', type: 'คลินิก', quote: 'จัดการแพทย์และคิวคนไข้ได้ง่ายขึ้น ทั้งแบบนัดและขออนุมัติ' },
  { name: 'Service Hub Center', type: 'ศูนย์บริการ', quote: 'พนักงานเห็นคิวเรียลไทม์ทุกสาขา และรายงานช่วยวางกำลังคนได้ดี' },
];

export const featureCompare = [
  { key: 'จำนวนสาขา', trial: '1', starter: '1', pro: '5', business: 'ไม่จำกัด', enterprise: 'Custom' },
  { key: 'จำนวนบริการ', trial: '1', starter: '3', pro: 'ไม่จำกัด', business: 'ไม่จำกัด', enterprise: 'ไม่จำกัด' },
  { key: 'Bookings / เดือน', trial: '50', starter: '100', pro: '2,000', business: '10,000', enterprise: 'Custom' },
  { key: 'LINE Auto Reply', trial: '-', starter: '-', pro: '✓', business: '✓', enterprise: '✓' },
  { key: 'Chat Inbox', trial: '-', starter: '-', pro: '-', business: '✓', enterprise: '✓' },
  { key: 'SLA / Dedicated Support', trial: '-', starter: '-', pro: '-', business: '-', enterprise: '✓' },
];

export const faqs = [
  { q: 'ต้องมี LINE OA ก่อนใช้งานไหม?', a: 'แนะนำให้มี LINE OA เพื่อให้ลูกค้าจองผ่านแชทได้ทันที' },
  { q: 'รองรับหลายสาขาหรือไม่?', a: 'รองรับหลายสาขา และแยกการจัดการคิวตามสาขาได้' },
  { q: 'เริ่มใช้งานใช้เวลานานไหม?', a: 'สามารถเริ่มใช้งานจริงได้ภายในไม่กี่นาทีหลังตั้งค่าเสร็จ' },
];
