/**
 * Copy and data of the home page (`/`). One place to edit so the visible page,
 * the FAQ JSON-LD and `llms.txt` cannot drift apart.
 *
 * Numbers here describe the product as shipped (plans in `content.ts`,
 * 21 business scenarios, 11 signage templates). No usage statistics: those
 * come from real data or not at all.
 */

import type { LandingIconName } from './landing-icons';

/** Short line under the hero buttons. */
export const heroTrustPoints = ['ฟรี 50 คิว/เดือน ตลอดชีพ', 'เชื่อม LINE OA ใน 15–30 นาที', 'ทีมคนไทยช่วยตั้งค่า'] as const;

/** Business names in the strip under the hero. */
export const heroBusinessStrip = ['ร้านตัดผม', 'คลินิก', 'ร้านทำเล็บ', 'ร้านอาหาร', 'สนามแบด', 'สนามเทนนิส', 'ฟิตเนส / โยคะ', 'ห้องประชุม', 'ศูนย์บริการ', 'คาร์แคร์'] as const;

export type SetupStep = { title: string; desc: string; image: string; alt: string };

/** "วิธีสร้างระบบจองคิวผ่านไลน์ใน 3 ขั้น" — the order is the real onboarding order. */
export const setupSteps: SetupStep[] = [
  {
    title: 'สมัครและตั้งค่าร้าน',
    desc: 'เลือกประเภทธุรกิจ ระบบสร้างสาขา บริการ และเวลาทำการเริ่มต้นให้ทันที แก้ชื่อ ราคา และจำนวนคิวต่อรอบได้เอง',
    image: '/images/product/portal-dashboard.webp',
    alt: 'หน้าภาพรวมหลังบ้านหลังสมัคร แสดงจำนวนคิววันนี้และกราฟ 14 วัน',
  },
  {
    title: 'เชื่อม LINE OA และเผยแพร่ Rich Menu',
    desc: 'วาง Channel token แล้วกดเผยแพร่ Rich Menu สำเร็จรูปตามประเภทธุรกิจจากระบบ ใช้เวลาประมาณ 15–30 นาที ทีมงานช่วยได้',
    image: '/images/product/portal-rich-menu.webp',
    alt: 'ตัวสร้าง Rich Menu ในระบบ เลือกประเภทธุรกิจแล้วเผยแพร่ไป LINE',
  },
  {
    title: 'ลูกค้าจองเองจาก LINE',
    desc: 'ลูกค้ากดปุ่มจองคิวใน Rich Menu เลือกบริการ วัน เวลา ระบบยืนยันในแชท เตือนก่อนถึงคิว และให้ยกเลิกหรือเช็คอินเองได้',
    image: '/images/product/liff-services.webp',
    alt: 'ลูกค้าเลือกบริการในหน้าจองที่เปิดในแอป LINE',
  },
];

export type BusinessTile = { label: string; desc: string; href: string; icon: LandingIconName };

/**
 * Industry tiles. Each links to its `/solutions/*` page when one exists, else
 * to the sandbox of that business type, so the grid doubles as internal links
 * with the search phrase as anchor text.
 */
export const businessTiles: BusinessTile[] = [
  { label: 'ระบบจองคิวร้านตัดผม', desc: 'เลือกช่าง จองรายนาที', href: '/solutions/barbershop-booking-system', icon: 'scissors' },
  { label: 'ระบบจองคิวคลินิก', desc: 'นัดแพทย์ ขออนุมัติคิว เตือนนัด', href: '/solutions/clinic-booking-system', icon: 'plus' },
  { label: 'ระบบจองร้านทำเล็บ', desc: 'ล็อกเวลาต่อคิว ไม่จองซ้อนช่าง', href: '/solutions/nail-salon-booking-system', icon: 'nail' },
  { label: 'ระบบจองร้านอาหาร', desc: 'จองโต๊ะ คิวหน้าร้าน สั่งอาหารถึงโต๊ะ', href: '/solutions/restaurant-booking-system', icon: 'fork' },
  { label: 'ระบบจองสนามแบด', desc: 'จองคอร์ทรายชั่วโมง จ่ายล่วงหน้า', href: '/solutions/badminton-court-booking-system', icon: 'court' },
  { label: 'ระบบจองสนามเทนนิส', desc: 'คอร์ท โค้ช คลาสเรียน', href: '/solutions/tennis-court-booking-system', icon: 'tennis' },
  { label: 'ระบบจองคลาสฟิตเนส / โยคะ', desc: 'ผูกครูกับคลาส จำกัดที่นั่ง', href: '/solutions/fitness-class-booking-system', icon: 'dumbbell' },
  { label: 'ระบบจองห้องประชุม', desc: 'รายชั่วโมง ครึ่งวัน เต็มวัน', href: '/solutions/meeting-room-booking-system', icon: 'room' },
  { label: 'ระบบจองร้านบุฟเฟ่ต์', desc: 'รับเป็นรอบ คุมที่นั่งต่อรอบ', href: '/solutions/buffet-booking-system', icon: 'buffet' },
  { label: 'ระบบจองคิวคาร์แคร์', desc: 'ช่องล้างว่าง แยกเวลาตามขนาดรถ', href: '/sandbox-demo/car-care', icon: 'car' },
  { label: 'ระบบจองคิวอาบน้ำตัดขน', desc: 'สัตว์เลี้ยง แยกเวลาตามขนาดตัว', href: '/sandbox-demo/pet-grooming', icon: 'paw' },
  { label: 'ดูทั้ง 21 ประเภทธุรกิจ', desc: 'ห้องทดลองแยกตามธุรกิจ ไม่ต้องสมัคร', href: '/sandbox-demo', icon: 'arrow' },
];

export type CompareRow = { label: string; chat: string; form: string; app: string; me: string };

/** "รับคิวทาง LINE 4 วิธี" — generic alternatives, no competitor named. */
export const compareRows: CompareRow[] = [
  { label: 'ลูกค้าต้องโหลดแอปใหม่', chat: 'ไม่ต้อง', form: 'ไม่ต้อง', app: 'ต้อง', me: 'ไม่ต้อง จองใน LINE' },
  { label: 'เห็นเฉพาะเวลาที่ว่างจริง กันคิวซ้อน', chat: 'ไม่', form: 'ไม่', app: 'ได้', me: 'ได้ ต่อบริการและต่อช่าง' },
  { label: 'เตือนนัดอัตโนมัติทาง LINE', chat: 'พิมพ์เอง', form: 'ไม่', app: 'SMS / อีเมล', me: 'ได้ 15 นาที ถึง 1 วัน' },
  { label: 'รับเงินในแชท', chat: 'ส่งเลขบัญชี เช็คสลิปเอง', form: 'ไม่', app: 'บัตรเครดิต', me: 'PromptPay / แอปธนาคาร / สลิป' },
  { label: 'หลายสาขา สิทธิ์พนักงาน', chat: 'ไม่', form: 'ไม่', app: 'บางราย', me: 'ได้' },
  { label: 'ราคาเริ่มต้น', chat: 'เวลาพนักงาน', form: 'ฟรี', app: 'ราว 1,000–3,000 บาท/เดือน', me: 'ฟรี 50 คิว/เดือน' },
];

export type TrustFact = { value: string; label: string };

/** Facts about the product itself, each verifiable on this site. */
export const trustFacts: TrustFact[] = [
  { value: '21', label: 'ประเภทธุรกิจ มีห้องทดลองของตัวเอง' },
  { value: '11', label: 'เทมเพลตจอเรียกคิว' },
  { value: '15–30 นาที', label: 'เชื่อม LINE OA จนรับคิวได้' },
  { value: '0 บาท', label: 'เริ่มต้น ไม่ต้องใช้บัตรเครดิต' },
];

export type SupportItem = { title: string; desc: string };

/** Must agree with the support FAQ answer and the GoAlong SLA (P1 only is 24/7). */
export const supportItems: SupportItem[] = [
  { title: 'ซัพพอร์ตภาษาไทย', desc: 'LINE OA, โทร หรืออีเมล จันทร์–ศุกร์ 09:00–18:00' },
  { title: 'เหตุระบบล่ม รับแจ้ง 24 ชม.', desc: 'มอนิเตอร์อัตโนมัติ แจ้งทีมทันทีที่ผิดปกติ' },
  { title: 'ช่วยตั้งค่าให้ตั้งแต่วันแรก', desc: 'เชื่อม LINE OA ใส่บริการและเวลาทำการให้พร้อมใช้' },
];

/** Blog posts linked from the FAQ block, by slug in `blog-content.ts`. */
export const recommendedPostSlugs = [
  'connect-line-oa-to-queue-booking-system-step-by-step',
  'reduce-no-show-with-line-reminder',
  'line-queue-booking-system-price-and-real-cost',
] as const;

export type LandingFaq = { q: string; a: string };

/**
 * Home-page FAQ. Questions are written the way people search (Search Console
 * phrases), answers start with the answer and stay under 60 words so an AI
 * answer engine can quote one whole.
 */
export const landingFaqs: LandingFaq[] = [
  {
    q: 'ระบบจองคิวผ่าน LINE OA ฟรีไหม',
    a: 'ฟรี แพ็กเกจ Starter ใช้ได้ตลอดไม่มีวันหมดอายุ จำกัด 50 คิวต่อเดือน 1 สาขา 3 บริการ ไม่ต้องใช้บัตรเครดิต เมื่อร้านโตค่อยอัปเกรด',
  },
  {
    q: 'ต้องมี LINE OA ก่อนไหม',
    a: 'ไม่จำเป็นตอนสมัคร ลองหลังบ้านก่อนได้ แต่ลูกค้าจะจองผ่านแชทได้เมื่อเชื่อม LINE OA แล้ว LINE OA แบบฟรีก็ใช้ได้',
  },
  {
    q: 'สร้างระบบจองคิวผ่านไลน์เองต้องเขียนโปรแกรมไหม',
    a: 'ไม่ต้อง สมัคร เลือกประเภทธุรกิจ วาง Channel token แล้วเผยแพร่ Rich Menu จากระบบ ใช้เวลาประมาณ 15–30 นาที ทีมงานช่วยตั้งค่าให้ได้',
  },
  {
    q: 'LINE bot จองคิวทำงานอย่างไร',
    a: 'ลูกค้ากดปุ่มใน Rich Menu เปิดหน้าจองในแอป LINE เลือกบริการและเวลาที่ว่าง ระบบส่งการ์ดยืนยัน เตือนก่อนถึงคิว และตอบคำถาม "เช็คคิวของฉัน" หรือ "ยกเลิกคิว" ได้เอง',
  },
  {
    q: 'ระบบนัดหมายออนไลน์ต่างจากระบบจองคิวอย่างไร',
    a: 'ในระบบนี้คือสิ่งเดียวกัน ตั้งบริการเป็นนัดเวลาแน่นอน รับเป็นรอบ ต้องอนุมัติก่อน หรือ walk-in หน้าร้านได้ต่อบริการ',
  },
  {
    q: 'รองรับหลายสาขาไหม',
    a: 'รองรับ แยกเวลาทำการ พนักงาน และคิวของแต่ละสาขา ผู้จัดการสาขาเห็นเฉพาะสาขาตัวเอง เจ้าของเห็นทุกสาขา',
  },
  {
    q: 'รับเงินมัดจำได้ไหม',
    a: 'ระบบเรียกเก็บราคาบริการที่ตั้งไว้ผ่าน PromptPay QR แอปธนาคาร หรือโอนแนบสลิป ถ้าต้องการเก็บบางส่วน ตั้ง "ค่าจอง" เป็นบริการแยกแล้วเก็บส่วนที่เหลือหน้าร้าน',
  },
  {
    q: 'ราคารวมค่าส่งข้อความ LINE แล้วหรือยัง',
    a: 'ยังไม่รวม ค่าข้อความคิดตามอัตราของ LINE Messaging API ซึ่งร้านชำระกับ LINE โดยตรง',
  },
  {
    q: 'ข้อมูลลูกค้าเป็นของใคร',
    a: 'ของร้าน ส่งออกเป็นไฟล์ได้ตลอดเวลา จัดเก็บตามหลัก PDPA และไม่นำไปใช้กับร้านอื่น',
  },
  {
    q: 'ติดปัญหาติดต่อได้ทางไหน',
    a: 'LINE OA @queuebooking หรือโทร จันทร์–ศุกร์ 09:00–18:00 เหตุระบบล่มรับแจ้งตลอด 24 ชั่วโมง',
  },
];

/** The definition paragraph under the H1; also the `speakable` target. */
export const landingDefinition =
  'QueueBooking คือระบบจองคิวออนไลน์ผ่าน LINE OA สำหรับร้านค้า คลินิก และสนามกีฬาในไทย ลูกค้ากดจองจาก Rich Menu ใน LINE ได้เองโดยไม่ต้องโหลดแอป ระบบเตือนนัดอัตโนมัติ รับชำระ PromptPay ในแชท และให้ร้านจัดคิวทุกสาขาจากหลังบ้านเดียว เริ่มใช้ฟรี 50 คิวต่อเดือน';

/** Sample shop used by the LINE demo and the Flex cards on the page. Fictional. */
export const demoShop = {
  shopName: 'คลินิกตัวอย่าง',
  branch: 'สาขาสุขุมวิท',
  service: 'ตรวจสุขภาพทั่วไป',
  queueNumber: 'A007',
  dateLabel: 'อ. 11 พ.ย. 2569',
  time: '10:00',
  room: 'ห้องตรวจ 2',
} as const;
