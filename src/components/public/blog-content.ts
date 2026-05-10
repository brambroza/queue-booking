export type BlogPost = {
  slug: string;
  title: string;
  description: string;
  category: string;
  publishedAt: string; // YYYY-MM-DD
  readingMinutes: number;
  keywords: string[];
  sections: Array<{ heading: string; body: string[] }>;
};

export const blogPosts: BlogPost[] = [
  {
    slug: 'line-oa-queue-booking-for-business',
    title: 'ระบบจองคิวผ่าน LINE OA คืออะไร และเหมาะกับธุรกิจแบบไหน',
    description: 'อธิบายภาพรวมระบบจองคิวผ่าน LINE OA, LIFF และ Dashboard พร้อมตัวอย่างธุรกิจที่ใช้งานได้จริง',
    category: 'พื้นฐานระบบจองคิว',
    publishedAt: '2026-05-10',
    readingMinutes: 6,
    keywords: ['ระบบจองคิว line oa', 'liff booking', 'queue booking'],
    sections: [
      {
        heading: 'ทำไมธุรกิจบริการควรมีระบบจองคิว',
        body: [
          'การจัดคิวด้วยแชทหรือจดมือทำให้เกิดคิวซ้ำ ตอบลูกค้าช้า และวัดผลไม่ได้ชัดเจน.',
          'ระบบจองคิวที่เชื่อม LINE OA ช่วยให้ลูกค้าจองได้ทันที และทีมงานดูคิวทั้งหมดในหน้าเดียว.',
        ],
      },
      {
        heading: 'องค์ประกอบหลักของระบบ',
        body: [
          'ฝั่งลูกค้า: ถามคิวว่างผ่าน LINE และจองผ่าน LIFF.',
          'ฝั่งร้าน: Dashboard สำหรับจัดการสาขา บริการ เวลาทำการ และสถานะคิว.',
        ],
      },
      {
        heading: 'เหมาะกับธุรกิจแบบไหน',
        body: [
          'ร้านตัดผม คลินิก ร้านอาหาร ศูนย์บริการ และธุรกิจที่ต้องนัดหมายล่วงหน้า.',
          'รองรับทั้งคิวแบบ fixed slot และ flexible duration.',
        ],
      },
    ],
  },
  {
    slug: 'reduce-no-show-with-line-reminder',
    title: 'ลด No-show ด้วยการยืนยันคิวและแจ้งเตือนผ่าน LINE',
    description: 'แนวทางลดลูกค้าไม่มาตามนัดด้วยการออกแบบ flow ยืนยันคิวและแจ้งเตือนก่อนถึงเวลาบริการ',
    category: 'การจัดการคิว',
    publishedAt: '2026-05-10',
    readingMinutes: 5,
    keywords: ['ลด no-show', 'ยืนยันคิว line', 'แจ้งเตือนนัดหมาย'],
    sections: [
      {
        heading: 'สาเหตุ No-show ที่พบบ่อย',
        body: [
          'ลูกค้าลืมนัด เปลี่ยนแผนกะทันหัน หรือไม่เห็นข้อความยืนยัน.',
          'หากไม่มีระบบแจ้งเตือนอัตโนมัติ ร้านจะเสีย slot ที่ขายได้.',
        ],
      },
      {
        heading: 'Flow ที่ควรมีในระบบ',
        body: [
          'ส่งข้อความยืนยันทันทีหลังจอง พร้อมเลขคิวและเวลานัด.',
          'แจ้งเตือนซ้ำก่อนเวลา 1 วัน และ 1 ชั่วโมง (ปรับตามธุรกิจ).',
        ],
      },
      {
        heading: 'ตัวชี้วัดที่ควรติดตาม',
        body: [
          'อัตรา no-show, อัตรายกเลิก และจำนวนลูกค้าที่ตอบกลับข้อความยืนยัน.',
          'นำข้อมูลไปปรับช่วงเวลาพีคและการจัดพนักงาน.',
        ],
      },
    ],
  },
  {
    slug: 'how-to-setup-liff-booking-correctly',
    title: 'วิธีตั้งค่า LIFF สำหรับหน้าจองคิวให้ถูกต้อง',
    description: 'เช็กลิสต์ตั้งค่า LIFF ID, Endpoint URL และการแยก LIFF สำหรับหน้า Booking/Member',
    category: 'คู่มือตั้งค่า',
    publishedAt: '2026-05-10',
    readingMinutes: 7,
    keywords: ['ตั้งค่า liff', 'invalid liff id', 'line liff booking'],
    sections: [
      {
        heading: 'ตั้งค่า LIFF พื้นฐาน',
        body: [
          'กำหนด Endpoint URL ให้ตรงกับโดเมน production.',
          'ตรวจสอบว่าเปิด LIFF จาก LINE app หรือ browser ตาม flow ที่ต้องการ.',
        ],
      },
      {
        heading: 'แยก LIFF ตามการใช้งาน',
        body: [
          'หน้า booking และหน้า member สามารถใช้ LIFF คนละตัวได้.',
          'ควรกำหนด env แยก เช่น NEXT_PUBLIC_LIFF_BOOKING_ID และ NEXT_PUBLIC_LIFF_MEMBER_ID.',
        ],
      },
      {
        heading: 'วิธี debug เมื่อขึ้น invalid liff id',
        body: [
          'เช็ก LIFF ID ใน DB/ENV ว่าตรงกับ LIFF app ที่ deploy จริง.',
          'เช็ก URL rich menu ว่าเป็นรูปแบบ https://liff.line.me/{LIFF_ID}?shop_key=... เท่านั้น.',
        ],
      },
    ],
  },
];

export function getBlogBySlug(slug: string) {
  return blogPosts.find((p) => p.slug === slug) ?? null;
}

