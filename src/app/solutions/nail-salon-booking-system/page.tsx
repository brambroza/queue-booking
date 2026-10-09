import type { Metadata } from 'next';
import BackHandRoundedIcon from '@mui/icons-material/BackHandRounded';
import ColorLensRoundedIcon from '@mui/icons-material/ColorLensRounded';
import SpaRoundedIcon from '@mui/icons-material/SpaRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import TimerRoundedIcon from '@mui/icons-material/TimerRounded';
import PaymentsRoundedIcon from '@mui/icons-material/PaymentsRounded';
import StorefrontRoundedIcon from '@mui/icons-material/StorefrontRounded';
import NotificationsActiveRoundedIcon from '@mui/icons-material/NotificationsActiveRounded';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import PhotoLibraryRoundedIcon from '@mui/icons-material/PhotoLibraryRounded';
import { SolutionPage, type SolutionPageContent } from '@/components/public/solution-page';

const path = '/solutions/nail-salon-booking-system';
const title = 'ระบบจองร้านทำเล็บผ่าน LINE OA | เลือกช่าง จองคิวแน่นอน มัดจำ PromptPay | QueueBooking';
const description =
  'ระบบจองร้านทำเล็บผ่าน LINE OA ให้ลูกค้าเลือกช่างและเวลาที่ว่างจริงได้เอง ล็อกเวลาต่อบริการตามความยาวงาน กันคิวซ้อนชั่วโมงพีค รับมัดจำ PromptPay กันจองแล้วไม่มา และเตือนลูกค้าก่อนถึงคิวอัตโนมัติ';

export const metadata: Metadata = {
  title,
  description,
  keywords: [
    'ระบบจองร้านทำเล็บ',
    'จองทำเล็บผ่าน LINE',
    'ระบบจองคิวร้านเล็บ',
    'โปรแกรมจองคิวร้านทำเล็บ',
    'ระบบจองร้านเล็บออนไลน์',
    'ระบบจองร้านเสริมสวย',
    'ระบบจองร้านต่อขนตา',
    'ระบบคิวร้านสปา',
  ],
  alternates: { canonical: path, languages: { 'th-TH': path, 'x-default': path } },
  openGraph: { title, description, url: path, type: 'website', locale: 'th_TH' },
};

const content: SolutionPageContent = {
  path,
  badge: 'Nail & Beauty Salon Booking Platform',
  heroTitle: 'ให้ลูกค้าเลือกช่างและจองคิวทำเล็บผ่าน LINE ได้เอง ไม่ต้องรอแอดมินตอบ',
  heroSubtitle:
    'ลูกค้าเห็นเฉพาะเวลาที่ช่างว่างจริง ระบบล็อกเวลาตามความยาวของแต่ละบริการ เช่น เจล 60 นาที ต่อเล็บ 120 นาที รับมัดจำ PromptPay ในแชท และส่งข้อความเตือนก่อนถึงคิวให้อัตโนมัติ',
  heroPills: ['เลือกช่างที่ชอบ', 'ล็อกเวลาตามบริการ', 'มัดจำ PromptPay', 'เตือนก่อนถึงคิว'],
  whyTitle: 'ทำไมร้านทำเล็บถึงควรใช้ QueueBooking',
  whyItems: ['คิวไม่ซ้อนแม้ชั่วโมงพีค', 'ลูกค้าประจำจองช่างเดิมได้เอง', 'มัดจำลดคนจองแล้วไม่มา', 'รายงานช่างและบริการยอดนิยม'],
  painTitle: 'ร้านของคุณกำลังเจอปัญหาเหล่านี้หรือไม่?',
  painPoints: [
    'ช่างกำลังทำเล็บ ไม่มีมือว่างตอบแชทรับจอง',
    'รับจองในแชทจนช่างคนเดียวโดนจองซ้อน',
    'ลูกค้าจองแล้วไม่มา ช่างว่างทั้งช่วงบ่าย',
    'งานต่อเล็บใช้เวลานานกว่าที่กะไว้ คิวถัดไปต้องรอ',
    'ลูกค้าอยากได้ช่างคนเดิมแต่ต้องถามทุกครั้งว่าว่างไหม',
    'ไม่รู้ว่าช่างคนไหนคิวแน่น บริการไหนขายดี',
  ],
  featuresTitle: 'ระบบจองร้านทำเล็บผ่าน LINE แบบครบวงจร',
  solutionFeatures: [
    'จองคิวผ่าน LINE OA',
    'เลือกช่างที่ต้องการ',
    'ตั้งเวลาต่อบริการ เช่น เจล 60 ต่อเล็บ 120 นาที',
    'ผูกช่างกับบริการที่ทำได้',
    'กันคิวซ้อนอัตโนมัติ',
    'รับมัดจำ PromptPay',
    'เตือนก่อนถึงคิวทาง LINE',
    'ย้ายคิวและแจ้งลูกค้าทาง LINE',
    'รายงานช่างและบริการ',
  ],
  stepsTitle: 'ลูกค้าจองได้ใน 6 ขั้นตอน',
  steps: ['เพิ่มเพื่อน LINE OA ของร้าน', 'เลือกบริการ เช่น เจล ต่อเล็บ เพนต์', 'เลือกช่างที่ต้องการ', 'เลือกวันและเวลาที่ช่างว่าง', 'ชำระมัดจำ PromptPay', 'รับข้อความยืนยันและเตือนก่อนถึงคิว'],
  useCasesTitle: 'ตัวอย่างการใช้งานสำหรับร้านทำเล็บแต่ละแบบ',
  useCases: [
    { title: 'ร้านเล็บเจล', desc: 'ตั้งบริการทาเจล 60 นาที ล้างเจล 30 นาที ระบบจัดช่วงเวลาให้พอดีไม่ชนคิวถัดไป.', icon: ColorLensRoundedIcon },
    { title: 'ต่อเล็บ / เพนต์ลาย', desc: 'งานยาว 2-3 ชั่วโมง ล็อกช่างทั้งช่วง และเก็บมัดจำก่อนเพื่อกันจองทิ้ง.', icon: BackHandRoundedIcon },
    { title: 'ลูกค้าประจำเลือกช่าง', desc: 'ลูกค้าเลือกช่างคนเดิมได้เองใน LINE ระบบแสดงเฉพาะเวลาที่ช่างคนนั้นว่าง.', icon: PersonRoundedIcon },
    { title: 'ร้านเล็บ + ต่อขนตา', desc: 'ผูกช่างกับบริการที่ทำได้ ระบบแสดงเฉพาะช่างที่ทำบริการที่ลูกค้าเลือก.', icon: SpaRoundedIcon },
    { title: 'บริการตามเวลายืดหยุ่น', desc: 'งานเพนต์ที่เวลาต่างกันตามลาย ตั้งช่วงเวลายืดหยุ่นแล้วให้ร้านยืนยันก่อน.', icon: TimerRoundedIcon },
    { title: 'โชว์ผลงานในหน้าจอง', desc: 'ใส่รูปผลงานของแต่ละช่างและบริการในหน้า LINE ให้ลูกค้าเลือกได้มั่นใจ.', icon: PhotoLibraryRoundedIcon },
    { title: 'ร้านหลายสาขา', desc: 'รับจองทุกสาขาจาก LINE OA เดียว ดูตารางช่างทุกสาขาในหลังบ้านเดียว.', icon: StorefrontRoundedIcon },
    { title: 'ร้านที่ต้องการรายงาน', desc: 'ดูว่าช่างคนไหนคิวแน่น บริการไหนขายดี ช่วงไหนว่าง เพื่อวางโปรโมชัน.', icon: InsightsRoundedIcon },
  ],
  benefitsTitle: 'ประโยชน์ที่ร้านทำเล็บจะได้รับ',
  benefits: ['คิวไม่ซ้อน ช่างไม่ชนกัน', 'ช่างไม่ต้องหยุดงานมาตอบแชท', 'ลดคนจองแล้วไม่มาด้วยมัดจำ', 'ลูกค้าจองได้ 24 ชั่วโมง', 'ลูกค้าประจำได้ช่างเดิมเสมอ', 'เตือนก่อนถึงคิวอัตโนมัติ', 'เห็นทุกช่างทุกสาขาหน้าเดียว', 'วางโปรโมชันจากข้อมูลจริง'],
  featureHighlights: [
    { title: 'เลือกช่าง', desc: 'ลูกค้าเลือกช่างเอง ระบบแสดงเฉพาะเวลาที่ว่างจริง', icon: PersonRoundedIcon },
    { title: 'เวลาต่อบริการ', desc: 'ตั้งนาทีต่อบริการ ระบบจัดช่วงเวลาให้พอดี', icon: TimerRoundedIcon },
    { title: 'มัดจำ PromptPay', desc: 'ส่ง QR ในแชท ล็อกคิวเมื่อชำระสำเร็จ', icon: PaymentsRoundedIcon },
    { title: 'เตือนทาง LINE', desc: 'ส่งข้อความเตือนก่อนถึงคิวตามเวลาที่ร้านตั้ง', icon: NotificationsActiveRoundedIcon },
    { title: 'รูปผลงาน', desc: 'ใส่รูปช่างและบริการในหน้าจองให้ลูกค้าเลือกง่าย', icon: PhotoLibraryRoundedIcon },
    { title: 'รายงานร้าน', desc: 'คิวต่อช่าง บริการยอดนิยม และรายได้มัดจำ', icon: InsightsRoundedIcon },
  ],
  previewItems: [
    { title: 'ตารางช่างรายวัน', image: '/images/use-cases/barber/calendar-view.jpg', alt: 'ตัวอย่างปฏิทินการจองแยกตามช่างในระบบหลังบ้าน', width: 749, height: 901 },
    { title: 'หน้าเลือกช่างใน LINE', image: '/images/product/barber/liff-slots.webp', alt: 'ตัวอย่างหน้าเลือกช่างและเวลาผ่าน LINE', width: 780, height: 1688 },
    { title: 'รายการจองวันนี้', image: '/images/product/barber/portal-bookings.webp', alt: 'ตัวอย่างรายการจองประจำวันในระบบหลังบ้าน', width: 2320, height: 2064 },
    { title: 'แจ้งเตือนทีมงาน', image: '/images/use-cases/barber/notification-dropdown.jpg', alt: 'ตัวอย่างการแจ้งเตือนการจองใหม่ให้ทีมงาน', width: 439, height: 621 },
  ],
  faqItems: [
    { q: 'ระบบจองร้านทำเล็บผ่าน LINE คืออะไร', a: 'คือระบบที่ให้ลูกค้าเลือกบริการ เลือกช่าง และจองเวลาผ่าน LINE OA ของร้านได้เอง พร้อมมัดจำและแจ้งเตือนอัตโนมัติ.' },
    { q: 'ลูกค้าเลือกช่างเองได้หรือไม่', a: 'ได้ ตั้งช่างแต่ละคนเป็นทรัพยากร ลูกค้าเลือกช่างที่ต้องการแล้วระบบแสดงเฉพาะเวลาที่ช่างคนนั้นว่าง.' },
    { q: 'บริการใช้เวลาไม่เท่ากันจัดการอย่างไร', a: 'ตั้งนาทีต่อบริการได้ เช่น ทาเจล 60 นาที ต่อเล็บ 120 นาที ระบบล็อกช่างตามความยาวของงานจริง คิวถัดไปจึงไม่ชน.' },
    { q: 'ช่างบางคนทำได้เฉพาะบางบริการทำอย่างไร', a: 'ผูกช่างกับบริการที่ทำได้ เช่น ช่าง A ทำเล็บเจล ช่าง B ต่อขนตา ระบบแสดงเฉพาะช่างที่ตรงกับบริการที่ลูกค้าเลือก.' },
    { q: 'รับมัดจำกันจองแล้วไม่มาได้หรือไม่', a: 'ได้ ระบบส่ง PromptPay QR ในแชท LINE และล็อกคิวเมื่อชำระสำเร็จ.' },
    { q: 'ใส่รูปผลงานในหน้าจองได้หรือไม่', a: 'ได้ อัปโหลดรูปช่างและรูปบริการในหลังบ้าน รูปจะแสดงในหน้าจองบน LINE ให้ลูกค้าเลือกได้ง่ายขึ้น.' },
    { q: 'ช่างลาป่วยต้องย้ายคิวทำอย่างไร', a: 'ย้ายคิวไปช่างอื่นหรือเวลาอื่นจากหลังบ้าน ระบบส่งข้อความแจ้งลูกค้าทาง LINE พร้อมปุ่มรับทราบให้ทันที.' },
    { q: 'ลูกค้าต้องติดตั้งแอปเพิ่มหรือไม่', a: 'ไม่ต้อง ใช้ LINE ที่มีอยู่แล้วในการจองและรับแจ้งเตือน.' },
    { q: 'รองรับร้านหลายสาขาหรือไม่', a: 'รองรับ รับจองทุกสาขาจาก LINE OA เดียว และดูตารางช่างทุกสาขาในหลังบ้านเดียว.' },
    { q: 'มีรายงานหรือไม่', a: 'มี ดูจำนวนคิวต่อช่าง บริการยอดนิยม ช่วงเวลาพีค และรายได้มัดจำได้จาก Dashboard.' },
    { q: 'เริ่มต้นใช้งานอย่างไร', a: 'สมัครใช้งาน ตั้งบริการ ช่าง และเวลาเปิดปิด เชื่อม LINE OA แล้วเปิดรับจองได้ทันที.' },
  ],
  ctaTitle: 'เปลี่ยน LINE OA ของร้านทำเล็บให้เป็นระบบจองคิวอัตโนมัติ',
  ctaSubtitle: 'ให้ลูกค้าจองเองได้ตลอด และให้ช่างมีสมาธิกับงานตรงหน้า',
  schemaDescription: 'ระบบจองร้านทำเล็บผ่าน LINE OA สำหรับร้านเล็บเจล ต่อเล็บ และร้านเสริมสวย ที่ต้องการให้ลูกค้าเลือกช่างและจองเวลาได้เอง โดยระบบล็อกเวลาตามความยาวบริการและรับมัดจำ',
};

export default function NailSalonBookingSystemPage() {
  return <SolutionPage content={content} />;
}
