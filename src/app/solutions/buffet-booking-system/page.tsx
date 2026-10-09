import type { Metadata } from 'next';
import LocalDiningRoundedIcon from '@mui/icons-material/LocalDiningRounded';
import TableRestaurantRoundedIcon from '@mui/icons-material/TableRestaurantRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import TimerRoundedIcon from '@mui/icons-material/TimerRounded';
import PaymentsRoundedIcon from '@mui/icons-material/PaymentsRounded';
import StorefrontRoundedIcon from '@mui/icons-material/StorefrontRounded';
import NotificationsActiveRoundedIcon from '@mui/icons-material/NotificationsActiveRounded';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import TvRoundedIcon from '@mui/icons-material/TvRounded';
import CelebrationRoundedIcon from '@mui/icons-material/CelebrationRounded';
import { SolutionPage, type SolutionPageContent } from '@/components/public/solution-page';

const path = '/solutions/buffet-booking-system';
const title = 'ระบบจองร้านบุฟเฟ่ต์ผ่าน LINE OA | จองรอบ คุมที่นั่ง คิวหน้าร้าน | QueueBooking';
const description =
  'ระบบจองร้านบุฟเฟ่ต์ผ่าน LINE OA ให้ลูกค้าจองรอบเวลาและจำนวนคนได้เอง ระบบนับที่นั่งต่อรอบและปิดรับเมื่อเต็ม รับมัดจำ PromptPay กันจองแล้วไม่มา พร้อมคิว walk-in หน้าร้านและจอเรียกคิว';

export const metadata: Metadata = {
  title,
  description,
  keywords: [
    'ระบบจองร้านบุฟเฟ่ต์',
    'จองบุฟเฟ่ต์ผ่าน LINE',
    'ระบบจองรอบบุฟเฟ่ต์',
    'ระบบคิวร้านชาบู',
    'ระบบจองร้านหมูกระทะ',
    'ระบบจองร้านปิ้งย่าง',
    'ระบบคิวหน้าร้าน LINE',
    'ระบบจองโต๊ะบุฟเฟ่ต์ออนไลน์',
  ],
  alternates: { canonical: path, languages: { 'th-TH': path, 'x-default': path } },
  openGraph: { title, description, url: path, type: 'website', locale: 'th_TH' },
};

const content: SolutionPageContent = {
  path,
  badge: 'Buffet Round & Walk-in Queue Platform',
  heroTitle: 'ให้ลูกค้าจองรอบบุฟเฟ่ต์ผ่าน LINE และคุมที่นั่งต่อรอบได้แม่นยำ',
  heroSubtitle:
    'ลูกค้าเลือกรอบเวลาและจำนวนคนได้เองใน LINE ระบบนับที่นั่งต่อรอบและขึ้น "เต็ม" อัตโนมัติ รับมัดจำ PromptPay ก่อนล็อกโต๊ะ ส่วนลูกค้าหน้าร้านรับคิว walk-in แล้วรอดูจอเรียกคิวได้เลย',
  heroPills: ['จองรอบเวลาล่วงหน้า', 'นับที่นั่งต่อรอบ', 'มัดจำ PromptPay', 'คิว walk-in + จอเรียกคิว'],
  whyTitle: 'ทำไมร้านบุฟเฟ่ต์ถึงควรใช้ QueueBooking',
  whyItems: ['รอบเต็มปิดรับอัตโนมัติ', 'มัดจำลดคนจองแล้วไม่มา', 'คิวจองกับคิวหน้าร้านอยู่กระดานเดียว', 'รายงานรอบที่แน่นที่สุด'],
  painTitle: 'ร้านของคุณกำลังเจอปัญหาเหล่านี้หรือไม่?',
  painPoints: [
    'รับจองในแชทจนนับที่นั่งไม่ทัน รอบเย็นล้น',
    'ลูกค้าจองโต๊ะใหญ่แล้วไม่มา เสียรอบทั้งรอบ',
    'คิวจองล่วงหน้ากับคิว walk-in ตีกันหน้าร้าน',
    'พนักงานต้องตะโกนเรียกคิวจนลูกค้าหงุดหงิด',
    'ไม่รู้ว่ารอบไหนแน่นจริง รอบไหนว่างจนขาดทุน',
    'หลายสาขาแต่ต้องตอบ LINE แยกกันทุกร้าน',
  ],
  featuresTitle: 'ระบบจองร้านบุฟเฟ่ต์ผ่าน LINE แบบครบวงจร',
  solutionFeatures: [
    'จองรอบเวลาผ่าน LINE OA',
    'ระบุจำนวนคนต่อการจอง',
    'ตั้งจำนวนรับต่อรอบ เต็มแล้วปิดรับ',
    'รับมัดจำ PromptPay ก่อนล็อกโต๊ะ',
    'คิว walk-in หน้าร้านกดรับจาก LINE',
    'จอเรียกคิวหน้าร้าน (Signage)',
    'เตือนก่อนถึงรอบทาง LINE',
    'ย้ายรอบและแจ้งลูกค้าทาง LINE',
    'รายงานรอบและสาขา',
  ],
  stepsTitle: 'ลูกค้าจองได้ใน 6 ขั้นตอน',
  steps: ['เพิ่มเพื่อน LINE OA ของร้าน', 'เลือกสาขาและวัน', 'เลือกรอบเวลาที่ยังว่าง', 'ระบุจำนวนคน', 'ชำระมัดจำ PromptPay', 'รับข้อความยืนยันและเตือนก่อนถึงรอบ'],
  useCasesTitle: 'ตัวอย่างการใช้งานสำหรับร้านบุฟเฟ่ต์แต่ละแบบ',
  useCases: [
    { title: 'ชาบู / สุกี้', desc: 'เปิดรอบละ 90 นาที ตั้งจำนวนโต๊ะต่อรอบ ระบบปิดรับเมื่อครบและเปิดรอบถัดไปให้เอง.', icon: LocalDiningRoundedIcon },
    { title: 'หมูกระทะ / ปิ้งย่าง', desc: 'รอบเย็นแน่นทุกวัน ให้ลูกค้าจองล่วงหน้าพร้อมมัดจำ ลดโต๊ะว่างเพราะคนไม่มา.', icon: CelebrationRoundedIcon },
    { title: 'คิว walk-in หน้าร้าน', desc: 'ลูกค้าสแกน QR รับคิวใน LINE ไปเดินเล่นก่อนได้ ถึงคิวระบบส่งข้อความเรียก.', icon: GroupsRoundedIcon },
    { title: 'จอเรียกคิวหน้าร้าน', desc: 'ต่อทีวีหน้าร้านแสดงคิวที่กำลังเรียกและคิวถัดไป พนักงานไม่ต้องตะโกน.', icon: TvRoundedIcon },
    { title: 'โต๊ะใหญ่ / กลุ่มเลี้ยง', desc: 'ตั้งโต๊ะใหญ่เป็นทรัพยากรแยก รับจองเฉพาะกลุ่มที่ต้องยืนยันและมัดจำก่อน.', icon: TableRestaurantRoundedIcon },
    { title: 'รอบจำกัดเวลา', desc: 'ลูกค้าเห็นเวลาเริ่มรอบชัดเจน ระบบเตือนก่อนถึงรอบ ลดคนมาสายกินเวลารอบถัดไป.', icon: TimerRoundedIcon },
    { title: 'ร้านหลายสาขา', desc: 'รับจองทุกสาขาจาก LINE OA เดียว แยกรอบ ที่นั่ง และรายงานตามสาขา.', icon: StorefrontRoundedIcon },
    { title: 'ร้านที่ต้องการรายงาน', desc: 'ดูรอบที่แน่น รอบที่ว่าง อัตราคนไม่มา และยอดมัดจำ เพื่อวางโปรรอบว่าง.', icon: InsightsRoundedIcon },
  ],
  benefitsTitle: 'ประโยชน์ที่ร้านบุฟเฟ่ต์จะได้รับ',
  benefits: ['รอบไม่ล้น ที่นั่งไม่เกิน', 'ลดโต๊ะว่างเพราะจองแล้วไม่มา', 'คิวจองกับ walk-in ไม่ตีกัน', 'ลูกค้ารอได้โดยไม่ต้องยืนหน้าร้าน', 'พนักงานไม่ต้องตอบแชทรับจอง', 'เตือนลูกค้าก่อนถึงรอบอัตโนมัติ', 'เห็นทุกสาขาหน้าเดียว', 'วางโปรโมชันจากข้อมูลรอบจริง'],
  featureHighlights: [
    { title: 'จำนวนรับต่อรอบ', desc: 'ตั้งความจุต่อรอบ ระบบนับและปิดรับเมื่อเต็ม', icon: GroupsRoundedIcon },
    { title: 'มัดจำ PromptPay', desc: 'ส่ง QR ในแชท ล็อกโต๊ะเมื่อชำระสำเร็จ', icon: PaymentsRoundedIcon },
    { title: 'จอเรียกคิว', desc: 'แสดงคิวที่เรียกบนทีวีหน้าร้านแบบเรียลไทม์', icon: TvRoundedIcon },
    { title: 'เตือนก่อนถึงรอบ', desc: 'ส่ง LINE เตือนลูกค้าก่อนเวลาตามที่ร้านตั้ง', icon: NotificationsActiveRoundedIcon },
    { title: 'คิว walk-in', desc: 'สแกน QR รับคิวใน LINE แล้วรอเรียกได้ทุกที่', icon: LocalDiningRoundedIcon },
    { title: 'รายงานรอบ', desc: 'รอบที่แน่น อัตราคนไม่มา และรายได้มัดจำ', icon: InsightsRoundedIcon },
  ],
  previewItems: [
    { title: 'ตารางรอบรายวัน', image: '/images/use-cases/buffet/calendar-view.jpg', alt: 'ตัวอย่างตารางการจองรอบบุฟเฟ่ต์รายวันในระบบหลังบ้าน', width: 749, height: 901 },
    { title: 'หน้าเลือกรอบใน LINE', image: '/images/product/buffet/liff-slots.webp', alt: 'ตัวอย่างหน้าเลือกรอบเวลาบุฟเฟ่ต์ผ่าน LINE', width: 780, height: 1688 },
    { title: 'รายการจองวันนี้', image: '/images/product/buffet/portal-bookings.webp', alt: 'ตัวอย่างรายการจองประจำวันของร้านบุฟเฟ่ต์ในระบบหลังบ้าน', width: 2320, height: 2064 },
    { title: 'แจ้งเตือนทีมงาน', image: '/images/use-cases/buffet/notification-dropdown.jpg', alt: 'ตัวอย่างการแจ้งเตือนการจองใหม่ให้ทีมงาน', width: 439, height: 621 },
  ],
  faqItems: [
    { q: 'ระบบจองร้านบุฟเฟ่ต์ผ่าน LINE คืออะไร', a: 'คือระบบที่ให้ลูกค้าจองรอบเวลาบุฟเฟ่ต์ ระบุจำนวนคน และวางมัดจำผ่าน LINE OA ของร้านได้เอง พร้อมคิว walk-in หน้าร้านและจอเรียกคิว.' },
    { q: 'จำกัดจำนวนคนต่อรอบได้หรือไม่', a: 'ได้ ตั้งจำนวนรับต่อรอบตามจำนวนโต๊ะหรือที่นั่ง เมื่อจองครบระบบแสดงว่าเต็มและปิดรับรอบนั้นอัตโนมัติ.' },
    { q: 'รับมัดจำกันจองแล้วไม่มาได้หรือไม่', a: 'ได้ ระบบส่ง PromptPay QR ในแชท LINE และล็อกการจองเมื่อชำระสำเร็จ ร้านตั้งได้ว่าจะเก็บมัดจำทุกรอบหรือเฉพาะโต๊ะใหญ่.' },
    { q: 'ลูกค้า walk-in หน้าร้านใช้ระบบเดียวกันได้หรือไม่', a: 'ได้ ลูกค้าสแกน QR หน้าร้านเพื่อรับคิวใน LINE แล้วไปรอที่อื่นได้ ถึงคิวระบบส่งข้อความเรียกและขึ้นจอหน้าร้าน.' },
    { q: 'มีจอเรียกคิวหน้าร้านหรือไม่', a: 'มี เปิดหน้าจอเรียกคิวบนทีวีหรือแท็บเล็ตหน้าร้าน แสดงคิวที่กำลังเรียกและคิวถัดไปแบบเรียลไทม์.' },
    { q: 'ลูกค้ามาสายแล้วกินเวลารอบถัดไปทำอย่างไร', a: 'ระบบส่งข้อความเตือนก่อนถึงรอบตามเวลาที่ร้านตั้ง และพนักงานเห็นเวลาเริ่มรอบชัดเจนบนกระดานคิว.' },
    { q: 'ย้ายรอบให้ลูกค้าได้หรือไม่', a: 'ได้ ย้ายรอบจากหลังบ้าน ระบบส่งข้อความแจ้งลูกค้าทาง LINE พร้อมปุ่มรับทราบให้ทันที.' },
    { q: 'ลูกค้าต้องติดตั้งแอปเพิ่มหรือไม่', a: 'ไม่ต้อง ใช้ LINE ที่มีอยู่แล้วในการจอง รับคิว และรับแจ้งเตือน.' },
    { q: 'รองรับร้านหลายสาขาหรือไม่', a: 'รองรับ รับจองทุกสาขาจาก LINE OA เดียว แยกรอบ ที่นั่ง และรายงานตามสาขาได้.' },
    { q: 'มีรายงานหรือไม่', a: 'มี ดูรอบที่แน่นที่สุด รอบที่ว่าง อัตราคนไม่มา และยอดมัดจำได้จาก Dashboard.' },
    { q: 'เริ่มต้นใช้งานอย่างไร', a: 'สมัครใช้งาน ตั้งรอบเวลา จำนวนรับต่อรอบ และเวลาเปิดปิด เชื่อม LINE OA แล้วเปิดรับจองได้ทันที.' },
  ],
  ctaTitle: 'เปลี่ยน LINE OA ของร้านบุฟเฟ่ต์ให้เป็นระบบจองรอบอัตโนมัติ',
  ctaSubtitle: 'ให้ลูกค้าจองรอบเองได้ตลอด และให้ทีมงานมีเวลาดูแลหน้าร้านมากขึ้น',
  schemaDescription: 'ระบบจองร้านบุฟเฟ่ต์ผ่าน LINE OA สำหรับร้านชาบู หมูกระทะ ปิ้งย่าง ที่ต้องการให้ลูกค้าจองรอบเวลาและจำนวนคนได้เอง คุมที่นั่งต่อรอบ รับมัดจำ และจัดคิว walk-in หน้าร้าน',
};

export default function BuffetBookingSystemPage() {
  return <SolutionPage content={content} />;
}
