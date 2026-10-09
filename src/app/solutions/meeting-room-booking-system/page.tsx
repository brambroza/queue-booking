import type { Metadata } from 'next';
import MeetingRoomRoundedIcon from '@mui/icons-material/MeetingRoomRounded';
import BusinessCenterRoundedIcon from '@mui/icons-material/BusinessCenterRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import TimerRoundedIcon from '@mui/icons-material/TimerRounded';
import PaymentsRoundedIcon from '@mui/icons-material/PaymentsRounded';
import StorefrontRoundedIcon from '@mui/icons-material/StorefrontRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import NotificationsActiveRoundedIcon from '@mui/icons-material/NotificationsActiveRounded';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import WifiRoundedIcon from '@mui/icons-material/WifiRounded';
import { SolutionPage, type SolutionPageContent } from '@/components/public/solution-page';

const path = '/solutions/meeting-room-booking-system';
const title = 'ระบบจองห้องประชุมผ่าน LINE OA | Co-working และพื้นที่ให้เช่ารายชั่วโมง | QueueBooking';
const description =
  'ระบบจองห้องประชุมผ่าน LINE OA ให้ลูกค้าและสมาชิกจองห้องรายชั่วโมง ครึ่งวัน หรือเต็มวันได้เอง ระบบเช็คห้องว่างแบบเรียลไทม์ กันจองซ้อน รับมัดจำ PromptPay และดูตารางทุกห้องทุกสาขาในหลังบ้านเดียว';

export const metadata: Metadata = {
  title,
  description,
  keywords: [
    'ระบบจองห้องประชุม',
    'จองห้องประชุมผ่าน LINE',
    'ระบบจองห้องประชุมออนไลน์',
    'โปรแกรมจองห้องประชุม',
    'ระบบจอง co-working space',
    'ระบบจองห้องประชุมรายชั่วโมง',
    'ระบบจองพื้นที่ให้เช่า',
    'ระบบจองห้องติว',
  ],
  alternates: { canonical: path, languages: { 'th-TH': path, 'x-default': path } },
  openGraph: { title, description, url: path, type: 'website', locale: 'th_TH' },
};

const content: SolutionPageContent = {
  path,
  badge: 'Meeting Room & Co-working Booking Platform',
  heroTitle: 'ให้ลูกค้าจองห้องประชุมผ่าน LINE ได้เอง ไม่จองซ้อน ไม่ต้องรอแอดมินตอบ',
  heroSubtitle:
    'สมาชิกเลือกห้อง วัน และช่วงเวลาได้เองตลอด 24 ชั่วโมง ระบบแสดงเฉพาะเวลาที่ห้องว่างจริงและล็อกทันทีเมื่อยืนยัน รับมัดจำ PromptPay ในแชท และแจ้งเตือนก่อนถึงเวลาใช้ห้องอัตโนมัติ',
  heroPills: ['จองรายชั่วโมง / ครึ่งวัน / เต็มวัน', 'กันจองซ้อนอัตโนมัติ', 'มัดจำ PromptPay', 'ตารางทุกห้องหน้าเดียว'],
  whyTitle: 'ทำไม Co-working และห้องประชุมให้เช่าถึงควรใช้ QueueBooking',
  whyItems: ['ห้องว่างแสดงแบบเรียลไทม์', 'จองซ้อนเป็นไปไม่ได้', 'มัดจำล็อกห้องกันจองทิ้ง', 'รายงานอัตราใช้ห้องต่อสาขา'],
  painTitle: 'พื้นที่ของคุณกำลังเจอปัญหาเหล่านี้หรือไม่?',
  painPoints: [
    'แอดมินต้องเปิดตารางเช็คห้องว่างทุกครั้งที่มีคนทัก',
    'จองซ้อนเพราะสองคนทักพร้อมกัน',
    'ลูกค้าจองแล้วไม่มา ห้องว่างทั้งช่วง',
    'ลูกค้ามาช้ากินเวลาคนจองถัดไป',
    'หลายห้องหลายสาขา ตารางกระจายหลายไฟล์',
    'ไม่รู้ว่าห้องไหนคุ้ม ห้องไหนว่างบ่อย',
  ],
  featuresTitle: 'ระบบจองห้องประชุมผ่าน LINE แบบครบวงจร',
  solutionFeatures: [
    'จองห้องผ่าน LINE OA',
    'แพ็กเกจรายชั่วโมง ครึ่งวัน เต็มวัน',
    'ตั้งแต่ละห้องเป็นทรัพยากรแยก',
    'กันจองซ้อนอัตโนมัติ',
    'รับมัดจำ PromptPay',
    'เตือนก่อนถึงเวลาใช้ห้อง',
    'ย้ายห้องหรือเวลาและแจ้งลูกค้าทาง LINE',
    'ล็อกห้องให้ลูกค้าประจำจากหลังบ้าน',
    'รายงานอัตราใช้ห้อง',
  ],
  stepsTitle: 'ลูกค้าจองได้ใน 6 ขั้นตอน',
  steps: ['เพิ่มเพื่อน LINE OA ของพื้นที่', 'เลือกสาขาและแพ็กเกจเวลา', 'เลือกวัน', 'เลือกห้องและช่วงเวลาที่ว่าง', 'ชำระมัดจำ PromptPay', 'รับข้อความยืนยันและเตือนก่อนถึงเวลา'],
  useCasesTitle: 'ตัวอย่างการใช้งานสำหรับพื้นที่แต่ละแบบ',
  useCases: [
    { title: 'Co-working Space', desc: 'เปิดห้องประชุมหลายขนาดให้สมาชิกจองเองผ่าน LINE ตามชั่วโมงที่ต้องการ.', icon: WifiRoundedIcon },
    { title: 'ห้องประชุมให้เช่า', desc: 'ขายเป็นแพ็กเกจครึ่งวันหรือเต็มวัน ระบบล็อกห้องทั้งช่วงทันทีที่มัดจำสำเร็จ.', icon: MeetingRoomRoundedIcon },
    { title: 'ห้องติว / ห้องเรียนพิเศษ', desc: 'ให้ผู้เรียนจองห้องรายชั่วโมง ตั้งความจุต่อห้องและแสดงห้องที่ว่างจริงเท่านั้น.', icon: GroupsRoundedIcon },
    { title: 'ห้องประชุมในองค์กร', desc: 'พนักงานจองห้องผ่าน LINE ภายใน ไม่ต้องถามเลขาฯ ว่าห้องว่างไหม.', icon: BusinessCenterRoundedIcon },
    { title: 'สตูดิโอ / ห้องซ้อม', desc: 'เปิดจองรายชั่วโมงพร้อมมัดจำ ลดการจองทิ้งที่ทำให้ห้องว่างทั้งช่วงเย็น.', icon: TimerRoundedIcon },
    { title: 'ลูกค้าประจำรายเดือน', desc: 'สร้างการจองซ้ำรายสัปดาห์จากหลังบ้าน ห้องถูกล็อกตลอดสัญญา.', icon: CalendarMonthRoundedIcon },
    { title: 'หลายสาขา', desc: 'ดูตารางทุกห้องทุกสาขาในหลังบ้านเดียว แยกรายงานตามสาขา.', icon: StorefrontRoundedIcon },
    { title: 'พื้นที่ที่ต้องการรายงาน', desc: 'ดูอัตราใช้ห้อง ช่วงพีค และห้องที่ว่างบ่อย เพื่อปรับราคาหรือโปรโมชัน.', icon: InsightsRoundedIcon },
  ],
  benefitsTitle: 'ประโยชน์ที่พื้นที่ให้เช่าจะได้รับ',
  benefits: ['ไม่มีจองซ้อน', 'แอดมินไม่ต้องตอบแชทเช็คห้อง', 'ลดการจองทิ้งด้วยมัดจำ', 'ลูกค้าจองได้ 24 ชั่วโมง', 'เตือนก่อนใช้ห้องอัตโนมัติ', 'ล็อกห้องให้ลูกค้าประจำได้', 'เห็นทุกห้องทุกสาขาหน้าเดียว', 'ปรับราคาจากข้อมูลการใช้จริง'],
  featureHighlights: [
    { title: 'ห้อง = ทรัพยากร', desc: 'แต่ละห้องมีตารางของตัวเอง จองซ้อนไม่ได้', icon: MeetingRoomRoundedIcon },
    { title: 'แพ็กเกจเวลา', desc: 'รายชั่วโมง ครึ่งวัน เต็มวัน ตั้งราคาแยกได้', icon: TimerRoundedIcon },
    { title: 'มัดจำ PromptPay', desc: 'ส่ง QR ในแชท ล็อกห้องเมื่อชำระสำเร็จ', icon: PaymentsRoundedIcon },
    { title: 'แจ้งเตือนทาง LINE', desc: 'เตือนก่อนถึงเวลา และแจ้งเมื่อย้ายห้องหรือเวลา', icon: NotificationsActiveRoundedIcon },
    { title: 'จองซ้ำรายสัปดาห์', desc: 'สร้างการจองทั้งสัญญาจากหลังบ้านครั้งเดียว', icon: CalendarMonthRoundedIcon },
    { title: 'รายงานการใช้ห้อง', desc: 'อัตราใช้ห้อง ช่วงพีค และรายได้มัดจำ', icon: InsightsRoundedIcon },
  ],
  previewItems: [
    { title: 'ตารางห้องรายวัน', image: '/images/use-cases/meeting-room/calendar-view.jpg', alt: 'ตัวอย่างตารางการจองห้องประชุมรายวันในระบบหลังบ้าน', width: 749, height: 901 },
    { title: 'หน้าเลือกห้องใน LINE', image: '/images/product/meeting-room/liff-slots.webp', alt: 'ตัวอย่างหน้าเลือกห้องและช่วงเวลาผ่าน LINE', width: 780, height: 1688 },
    { title: 'รายการจองวันนี้', image: '/images/product/meeting-room/portal-bookings.webp', alt: 'ตัวอย่างรายการจองห้องประชุมประจำวันในระบบหลังบ้าน', width: 2320, height: 2064 },
    { title: 'แจ้งเตือนทีมงาน', image: '/images/use-cases/meeting-room/notification-dropdown.jpg', alt: 'ตัวอย่างการแจ้งเตือนการจองใหม่ให้ทีมงาน', width: 439, height: 621 },
  ],
  faqItems: [
    { q: 'ระบบจองห้องประชุมผ่าน LINE คืออะไร', a: 'คือระบบที่ให้ลูกค้าหรือสมาชิกจองห้องประชุม ห้องติว หรือพื้นที่ให้เช่าผ่าน LINE OA ได้เอง โดยระบบแสดงเฉพาะเวลาที่ห้องว่างจริงและล็อกทันทีเมื่อยืนยัน.' },
    { q: 'กันจองซ้อนได้จริงหรือไม่', a: 'ได้ แต่ละห้องถูกตั้งเป็นทรัพยากรแยก ระบบตรวจความว่างก่อนยืนยันทุกครั้ง สองคนจองช่วงเดียวกันพร้อมกันจะมีเพียงคนเดียวที่สำเร็จ.' },
    { q: 'ขายเป็นครึ่งวันหรือเต็มวันได้หรือไม่', a: 'ได้ ตั้งเป็นบริการแยกตามระยะเวลา เช่น รายชั่วโมง ครึ่งวัน เต็มวัน พร้อมราคาของแต่ละแพ็กเกจ.' },
    { q: 'รับมัดจำได้หรือไม่', a: 'ได้ ระบบส่ง PromptPay QR ในแชท LINE และล็อกห้องเมื่อชำระสำเร็จ ลดการจองแล้วไม่มา.' },
    { q: 'ลูกค้าประจำจองรายสัปดาห์ทำอย่างไร', a: 'พนักงานสร้างการจองซ้ำจากหลังบ้านครั้งเดียว ห้องถูกล็อกตลอดช่วงสัญญาโดยไม่ต้องจองทีละครั้ง.' },
    { q: 'ต้องย้ายห้องให้ลูกค้าทำอย่างไร', a: 'ย้ายห้องหรือเวลาจากหลังบ้าน ระบบส่งข้อความแจ้งลูกค้าทาง LINE พร้อมปุ่มรับทราบให้ทันที.' },
    { q: 'ใช้กับห้องประชุมภายในองค์กรได้หรือไม่', a: 'ได้ ให้พนักงานเพิ่มเพื่อน LINE OA ภายในแล้วจองห้องเองโดยไม่ต้องผ่านเลขานุการ.' },
    { q: 'ลูกค้าต้องติดตั้งแอปเพิ่มหรือไม่', a: 'ไม่ต้อง ใช้ LINE ที่มีอยู่แล้วในการจองและรับแจ้งเตือน.' },
    { q: 'รองรับหลายสาขาหรือไม่', a: 'รองรับ ดูตารางทุกห้องทุกสาขาในหลังบ้านเดียว และแยกรายงานตามสาขาได้.' },
    { q: 'มีรายงานหรือไม่', a: 'มี ดูอัตราการใช้ห้องแต่ละห้อง ช่วงเวลาพีค และรายได้มัดจำได้จาก Dashboard.' },
    { q: 'เริ่มต้นใช้งานอย่างไร', a: 'สมัครใช้งาน ตั้งห้อง แพ็กเกจเวลา และเวลาเปิดปิด เชื่อม LINE OA แล้วเปิดรับจองได้ทันที.' },
  ],
  ctaTitle: 'เปลี่ยน LINE OA ของพื้นที่ให้เป็นระบบจองห้องอัตโนมัติ',
  ctaSubtitle: 'ให้ลูกค้าจองห้องเองได้ตลอด และให้ทีมงานเลิกเช็คตารางด้วยมือ',
  schemaDescription: 'ระบบจองห้องประชุมผ่าน LINE OA สำหรับ co-working space ห้องประชุมให้เช่า และห้องติว ที่ต้องการให้ลูกค้าจองห้องรายชั่วโมง ครึ่งวัน หรือเต็มวันได้เอง โดยระบบกันจองซ้อนและรับมัดจำ',
};

export default function MeetingRoomBookingSystemPage() {
  return <SolutionPage content={content} />;
}
