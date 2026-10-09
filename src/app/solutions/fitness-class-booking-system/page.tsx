import type { Metadata } from 'next';
import FitnessCenterRoundedIcon from '@mui/icons-material/FitnessCenterRounded';
import SelfImprovementRoundedIcon from '@mui/icons-material/SelfImprovementRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import TimerRoundedIcon from '@mui/icons-material/TimerRounded';
import PaymentsRoundedIcon from '@mui/icons-material/PaymentsRounded';
import StorefrontRoundedIcon from '@mui/icons-material/StorefrontRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import NotificationsActiveRoundedIcon from '@mui/icons-material/NotificationsActiveRounded';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import { SolutionPage, type SolutionPageContent } from '@/components/public/solution-page';

const path = '/solutions/fitness-class-booking-system';
const title = 'ระบบจองคลาสฟิตเนสและโยคะผ่าน LINE OA | จองคลาส เทรนเนอร์ จำกัดที่นั่ง | QueueBooking';
const description =
  'ระบบจองคลาสฟิตเนส โยคะ พิลาทิส ผ่าน LINE OA ให้สมาชิกจองคลาสกลุ่มและเทรนเนอร์ส่วนตัวได้เอง ระบบจำกัดจำนวนต่อคลาสและปิดรับเมื่อเต็ม ผูกครูกับคลาสที่สอน รับมัดจำ PromptPay และเตือนก่อนถึงคลาสอัตโนมัติ';

export const metadata: Metadata = {
  title,
  description,
  keywords: [
    'ระบบจองคลาสฟิตเนส',
    'ระบบจองคลาสโยคะ',
    'จองคลาสออกกำลังกายผ่าน LINE',
    'ระบบจองเทรนเนอร์',
    'โปรแกรมจองคลาสยิม',
    'ระบบจองคลาสพิลาทิส',
    'ระบบจัดการสตูดิโอโยคะ',
    'ระบบจองคลาสจำกัดจำนวน',
  ],
  alternates: { canonical: path, languages: { 'th-TH': path, 'x-default': path } },
  openGraph: { title, description, url: path, type: 'website', locale: 'th_TH' },
};

const content: SolutionPageContent = {
  path,
  badge: 'Fitness, Yoga & Personal Training Booking Platform',
  heroTitle: 'ให้สมาชิกจองคลาสและเทรนเนอร์ผ่าน LINE ได้เอง คลาสเต็มปิดรับอัตโนมัติ',
  heroSubtitle:
    'สมาชิกเห็นตารางคลาสและจำนวนที่ว่างแบบเรียลไทม์ จองคลาสกลุ่มหรือเทรนเนอร์ส่วนตัวได้ตลอด 24 ชั่วโมง ระบบผูกครูกับคลาสที่สอน รับมัดจำ PromptPay ในแชท และส่งข้อความเตือนก่อนถึงคลาส',
  heroPills: ['คลาสกลุ่มจำกัดจำนวน', 'จองเทรนเนอร์ส่วนตัว', 'ครูผูกกับคลาสที่สอน', 'เตือนก่อนถึงคลาส'],
  whyTitle: 'ทำไมฟิตเนสและสตูดิโอโยคะถึงควรใช้ QueueBooking',
  whyItems: ['คลาสเต็มแสดงอัตโนมัติ', 'ครูกับห้องไม่ชนกัน', 'มัดจำลดคนจองแล้วไม่มา', 'รายงานคลาสและครูที่ถูกจอง'],
  painTitle: 'สตูดิโอของคุณกำลังเจอปัญหาเหล่านี้หรือไม่?',
  painPoints: [
    'รับจองคลาสในแชทจนนับจำนวนไม่ทัน คนล้นห้อง',
    'สมาชิกจองแล้วไม่มา ที่นั่งว่างทั้งที่มีคนอยากเรียน',
    'เทรนเนอร์ถูกจองสองเวลาเดียวกัน',
    'ครูลาป่วยต้องไล่แจ้งเลื่อนทีละคน',
    'สมาชิกถามทุกวันว่าคลาสเย็นนี้เต็มหรือยัง',
    'ไม่รู้ว่าคลาสไหนคนชอบ คลาสไหนควรตัด',
  ],
  featuresTitle: 'ระบบจองคลาสฟิตเนสผ่าน LINE แบบครบวงจร',
  solutionFeatures: [
    'จองคลาสผ่าน LINE OA',
    'จำกัดจำนวนต่อคลาส เต็มแล้วปิดรับ',
    'จองเทรนเนอร์ส่วนตัว',
    'ผูกครูกับคลาสที่สอน',
    'เช็คครูและห้องว่างพร้อมกัน',
    'รับมัดจำ PromptPay',
    'เตือนก่อนถึงคลาสทาง LINE',
    'ยกเลิกหรือย้ายคลาสและแจ้งสมาชิกทาง LINE',
    'รายงานคลาสและครู',
  ],
  stepsTitle: 'สมาชิกจองได้ใน 6 ขั้นตอน',
  steps: ['เพิ่มเพื่อน LINE OA ของสตูดิโอ', 'เลือกประเภท: คลาสกลุ่ม / เทรนเนอร์ส่วนตัว', 'เลือกวัน', 'เลือกคลาสหรือครูที่ยังว่าง', 'ชำระมัดจำ PromptPay', 'รับข้อความยืนยันและเตือนก่อนถึงคลาส'],
  useCasesTitle: 'ตัวอย่างการใช้งานสำหรับสตูดิโอแต่ละแบบ',
  useCases: [
    { title: 'สตูดิโอโยคะ / พิลาทิส', desc: 'ตั้งจำนวนเสื่อต่อคลาส เมื่อจองครบระบบแสดง "เต็ม" ทันที ไม่ต้องให้ครูคอยนับ.', icon: SelfImprovementRoundedIcon },
    { title: 'ฟิตเนสคลาสกลุ่ม', desc: 'เปิดตารางคลาสรายสัปดาห์ สมาชิกเลือกคลาสและเวลาได้เองจาก LINE.', icon: FitnessCenterRoundedIcon },
    { title: 'เทรนเนอร์ส่วนตัว', desc: 'ตั้งเทรนเนอร์แต่ละคนเป็นทรัพยากร ระบบแสดงเฉพาะเวลาที่เทรนเนอร์ว่างจริง.', icon: PersonRoundedIcon },
    { title: 'ครูประจำคลาส', desc: 'ผูกครูกับคลาสที่สอน เช่น ครู A สอนโยคะ ครู B สอนมวย ระบบแสดงเฉพาะครูที่ตรงกับคลาส.', icon: GroupsRoundedIcon },
    { title: 'คลาสจำกัดเวลา', desc: 'สมาชิกเห็นเวลาเริ่มคลาสชัดเจน ระบบเตือนก่อนเริ่มเพื่อลดคนมาสาย.', icon: TimerRoundedIcon },
    { title: 'คอร์สเรียนต่อเนื่อง', desc: 'สร้างการจองทั้งคอร์ส 10 ครั้งจากหลังบ้าน ที่นั่งและครูถูกล็อกตลอดคอร์ส.', icon: CalendarMonthRoundedIcon },
    { title: 'หลายสาขา', desc: 'ดูตารางคลาสและครูทุกสาขาในหลังบ้านเดียว แยกรายงานตามสาขา.', icon: StorefrontRoundedIcon },
    { title: 'สตูดิโอที่ต้องการรายงาน', desc: 'ดูคลาสที่เต็มบ่อย คลาสที่ว่าง และครูที่ถูกจองมากสุด เพื่อจัดตารางใหม่.', icon: InsightsRoundedIcon },
  ],
  benefitsTitle: 'ประโยชน์ที่สตูดิโอจะได้รับ',
  benefits: ['คลาสไม่รับเกินจำนวน', 'ลดคนจองแล้วไม่มาด้วยมัดจำ', 'ครูและห้องไม่ชนกัน', 'สมาชิกจองได้ 24 ชั่วโมง', 'แจ้งเลื่อนทั้งคลาสในไม่กี่นาที', 'ล็อกคอร์สต่อเนื่องได้', 'เห็นทุกคลาสทุกสาขาหน้าเดียว', 'จัดตารางจากข้อมูลจริง'],
  featureHighlights: [
    { title: 'จำนวนต่อคลาส', desc: 'ตั้งความจุต่อคลาส เต็มแล้วปิดรับอัตโนมัติ', icon: GroupsRoundedIcon },
    { title: 'ครู + ห้อง', desc: 'ตรวจความว่างของทั้งสองอย่างก่อนยืนยันทุกการจอง', icon: FitnessCenterRoundedIcon },
    { title: 'มัดจำ PromptPay', desc: 'ส่ง QR ในแชท ล็อกที่นั่งเมื่อชำระสำเร็จ', icon: PaymentsRoundedIcon },
    { title: 'แจ้งเตือนทาง LINE', desc: 'เตือนก่อนถึงคลาส และแจ้งเมื่อย้ายหรือยกเลิกคลาส', icon: NotificationsActiveRoundedIcon },
    { title: 'คอร์สต่อเนื่อง', desc: 'สร้างการจองทั้งคอร์สจากหลังบ้านครั้งเดียว', icon: CalendarMonthRoundedIcon },
    { title: 'รายงานสตูดิโอ', desc: 'อัตราเต็มของคลาส ครูที่ถูกจอง และรายได้มัดจำ', icon: InsightsRoundedIcon },
  ],
  previewItems: [
    { title: 'ตารางคลาสและครู', image: '/images/use-cases/clinic/calendar-view.jpg', alt: 'ตัวอย่างปฏิทินการจองแยกตามทรัพยากรในระบบหลังบ้าน', width: 749, height: 901 },
    { title: 'หน้าเลือกคลาสใน LINE', image: '/images/product/liff-slots.webp', alt: 'ตัวอย่างหน้าเลือกคลาสและเวลาผ่าน LINE', width: 780, height: 1688 },
    { title: 'รายการจองวันนี้', image: '/images/product/portal-bookings.webp', alt: 'ตัวอย่างรายการจองประจำวันในระบบหลังบ้าน', width: 2400, height: 1833 },
    { title: 'แจ้งเตือนทีมงาน', image: '/images/use-cases/clinic/notification-dropdown.jpg', alt: 'ตัวอย่างการแจ้งเตือนการจองใหม่ให้ทีมงาน', width: 439, height: 621 },
  ],
  faqItems: [
    { q: 'ระบบจองคลาสฟิตเนสผ่าน LINE คืออะไร', a: 'คือระบบที่ให้สมาชิกจองคลาสกลุ่ม โยคะ พิลาทิส หรือเทรนเนอร์ส่วนตัวผ่าน LINE OA ของสตูดิโอได้เอง พร้อมมัดจำและแจ้งเตือนอัตโนมัติ.' },
    { q: 'จำกัดจำนวนคนต่อคลาสได้หรือไม่', a: 'ได้ ตั้งจำนวนรับต่อคลาสตามจำนวนเสื่อหรืออุปกรณ์ เมื่อจองครบระบบแสดงว่าเต็มและปิดรับอัตโนมัติ.' },
    { q: 'จองเทรนเนอร์ส่วนตัวได้หรือไม่', a: 'ได้ ตั้งเทรนเนอร์แต่ละคนเป็นทรัพยากร สมาชิกเลือกเทรนเนอร์แล้วระบบแสดงเฉพาะเวลาที่ว่างจริง.' },
    { q: 'ครูสอนได้เฉพาะบางคลาสตั้งได้หรือไม่', a: 'ได้ ผูกครูกับคลาสที่สอน ระบบจะแสดงเฉพาะครูที่ตรงกับคลาสที่สมาชิกเลือก.' },
    { q: 'รับมัดจำกันจองแล้วไม่มาได้หรือไม่', a: 'ได้ ระบบส่ง PromptPay QR ในแชท LINE และล็อกที่นั่งเมื่อชำระสำเร็จ.' },
    { q: 'ครูลาป่วยต้องยกเลิกคลาสทำอย่างไร', a: 'ยกเลิกหรือย้ายเวลาจากหลังบ้าน ระบบส่งข้อความแจ้งสมาชิกทุกคนในคลาสทาง LINE พร้อมปุ่มรับทราบ.' },
    { q: 'คอร์ส 10 ครั้งจองครั้งเดียวได้หรือไม่', a: 'ได้ พนักงานสร้างการจองทั้งคอร์สจากหลังบ้าน ที่นั่งและครูถูกล็อกตลอดคอร์ส.' },
    { q: 'สมาชิกต้องติดตั้งแอปเพิ่มหรือไม่', a: 'ไม่ต้อง ใช้ LINE ที่มีอยู่แล้วในการจองและรับแจ้งเตือน.' },
    { q: 'รองรับหลายสาขาหรือไม่', a: 'รองรับ ดูตารางคลาสและครูทุกสาขาในหลังบ้านเดียว และแยกรายงานตามสาขาได้.' },
    { q: 'มีรายงานหรือไม่', a: 'มี ดูอัตราเต็มของแต่ละคลาส ครูที่ถูกจองมากสุด ช่วงเวลาพีค และรายได้มัดจำได้จาก Dashboard.' },
    { q: 'เริ่มต้นใช้งานอย่างไร', a: 'สมัครใช้งาน ตั้งคลาส ครู จำนวนรับ และเวลาเปิดปิด เชื่อม LINE OA แล้วเปิดรับจองได้ทันที.' },
  ],
  ctaTitle: 'เปลี่ยน LINE OA ของสตูดิโอให้เป็นระบบจองคลาสอัตโนมัติ',
  ctaSubtitle: 'ให้สมาชิกจองเองได้ตลอด และให้ครูมีเวลาดูแลคนในคลาสมากขึ้น',
  schemaDescription: 'ระบบจองคลาสฟิตเนส โยคะ และเทรนเนอร์ส่วนตัวผ่าน LINE OA สำหรับสตูดิโอที่ต้องการจำกัดจำนวนต่อคลาส ผูกครูกับคลาสที่สอน รับมัดจำ และแจ้งเตือนสมาชิกอัตโนมัติ',
};

export default function FitnessClassBookingSystemPage() {
  return <SolutionPage content={content} />;
}
