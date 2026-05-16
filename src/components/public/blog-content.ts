export type BlogPost = {
  slug: string;
  title: string;
  description: string;
  category: string;
  publishedAt: string; // YYYY-MM-DD
  readingMinutes: number;
  keywords: string[];
  sections: Array<{ heading: string; body: string[] }>;
  assets?: {
    pdfUrl?: string;
    pdfLabel?: string;
    images?: Array<{ src: string; alt: string; caption: string }>;
  };
};

export const blogPosts: BlogPost[] = [
  {
    slug: 'barber-shop-line-queue-booking-customer-and-owner-flow',
    title: 'ตัวอย่างการใช้งานระบบจองคิวร้านตัดผม: ฝั่งลูกค้าและฝั่งร้าน',
    description: 'ดู flow ใช้งานจริงของร้านตัดผม ตั้งแต่ลูกค้าเลือกบริการ/เลือกช่างใน LIFF ไปจนถึงการแจ้งเตือนหลังบ้าน Calendar และ Digital Signage',
    category: 'ตัวอย่างการใช้งาน',
    publishedAt: '2026-05-16',
    readingMinutes: 8,
    keywords: ['ร้านตัดผม', 'line liff booking', 'เลือกช่าง', 'queue signage', 'notification'],
    sections: [
      {
        heading: 'ภาพรวม: ร้านตัดผมต้องเห็นอะไรบ้างในระบบเดียว',
        body: [
          'ระบบควรครอบคลุมทั้งฝั่งลูกค้าใน LINE และฝั่งร้านใน Dashboard เพื่อให้ทีมหน้าร้านไม่ต้องสลับหลายเครื่องมือ.',
          'ลูกค้าเห็นขั้นตอนจองที่สั้นและชัดเจน: เลือกบริการ > เลือกช่าง > เลือกวันเวลา > ยืนยัน.',
          'ฝั่งร้านเห็นการแจ้งเตือนคิวใหม่, ปฏิทินรวมคิวรายวัน/รายเดือน และหน้าจอเรียกคิวแบบ Signage สำหรับหน้าร้าน.',
        ],
      },
      {
        heading: 'Flow ฝั่งลูกค้า (LINE + LIFF)',
        body: [
          'ลูกค้ากด Rich Menu “จองคิว” เพื่อเปิด LIFF booking โดยไม่ต้องติดตั้งแอปเพิ่ม.',
          'ใน Step 1 ลูกค้าเลือกบริการ เช่น ตัดผมชาย และเลือกช่างที่ต้องการได้ทันที.',
          'ระบบรองรับการตั้ง label ให้เหมาะกับธุรกิจ เช่น ร้านตัดผมใช้คำว่า “เลือกช่าง”, ร้านอาหารใช้ “เลือกโต๊ะ”, ห้องประชุมใช้ “เลือกห้อง”.',
          'ใน Step 2 ลูกค้าเลือกวันที่ จากนั้นกดดูเวลาว่าง และเลือกช่วงเวลาที่ต้องการก่อนยืนยันจอง.',
          'หลังจองสำเร็จ ระบบส่งการ์ดยืนยันคิว (เลขคิว, สาขา, บริการ, วันเวลา) กลับไปในแชท LINE ทันที.',
        ],
      },
      {
        heading: 'Flow ฝั่งร้าน (Owner / Staff Dashboard)',
        body: [
          'เมื่อมีคิวใหม่ ระบบสร้าง Notification ในหลังบ้านเพื่อให้พนักงานเห็นรายการใหม่ทันที.',
          'หน้า Calendar แสดงคิวรายวัน/รายเดือน ช่วยให้ร้านเห็นช่วงเวลาพีคและกระจายคิวของแต่ละช่างได้ง่าย.',
          'หน้า Daily list แยกสถานะคิวชัดเจน เช่น confirmed, completed, cancelled สำหรับงานหน้าร้าน.',
          'หน้า Digital Signage แสดงคิวปัจจุบัน (Now Calling) และคิวถัดไป เพื่อให้ลูกค้าในร้านดูคิวได้ด้วยตัวเอง.',
        ],
      },
      {
        heading: 'แนวทางตั้งค่าให้ใช้งานลื่นสำหรับร้านตัดผม',
        body: [
          'สร้างบริการแยกตามงานจริง เช่น ตัดผมชาย, ตัดผม+สระ, ทำสีผม และกำหนดระยะเวลาให้ตรงงาน.',
          'สร้าง Resource เป็น “ช่าง” รายคน เพื่อให้ลูกค้าเลือกช่างได้และระบบคำนวณคิวไม่ชนกัน.',
          'กำหนด Working Hours และวันหยุดให้ครบทุกสาขา เพื่อให้ผล “ดูเวลาว่าง” ถูกต้อง.',
          'เปิด Notification Bell และ Queue Display ในจอหน้าร้าน เพื่อให้ทีมทำงานไวและลดการเรียกชื่อลูกค้าซ้ำ.',
        ],
      },
      {
        heading: 'Checklist ก่อนใช้งานจริง',
        body: [
          'ทดสอบจองจากมือถือจริงผ่าน LINE อย่างน้อย 1 รอบ (เลือกบริการ, เลือกช่าง, เลือกเวลา).',
          'ตรวจว่าหลังบ้านมี Notification และคิวเข้า Calendar/Bookings ครบ.',
          'ตรวจว่าหน้า Signage แสดงคิวปัจจุบันและคิวถัดไปถูกต้อง.',
          'หากทุกขั้นตอนผ่าน ร้านสามารถเปิดใช้งานจริงได้ทันทีโดยใช้ flow เดียวกับที่ลูกค้าเห็น.',
        ],
      },
    ],
  },
  {
    slug: 'line-msgapi-liff-login-richmenu-setup-guide',
    title: 'คู่มือตั้งค่า LINE Messaging API + LIFF + LINE Login + Rich Menu (ใช้งานจริง)',
    description: 'สรุปขั้นตอนตั้งค่า LINE ให้พร้อมใช้งานระบบจองคิว: Webhook, Channel Access Token, LIFF Booking/Member, LINE Login และ Rich Menu',
    category: 'คู่มือตั้งค่า',
    publishedAt: '2026-05-14',
    readingMinutes: 10,
    keywords: ['line messaging api', 'liff setup', 'line login', 'rich menu', 'webhook line'],
    assets: {
      pdfUrl: '/docs/line-setup-guide.pdf',
      pdfLabel: 'ดาวน์โหลดคู่มือการตั้งค่า LINE (PDF)',
      images: [
        {
          src: '/images/blog/line-setup/step-webhook-msgapi.jpg',
          alt: 'LINE Messaging API Webhook settings',
          caption: 'ตัวอย่างหน้าตั้งค่า Messaging API และ Webhook URL',
        },
        {
          src: '/images/blog/line-setup/step-liff-booking.jpg',
          alt: 'LIFF booking app settings',
          caption: 'ตัวอย่าง LIFF สำหรับหน้า Booking (/liff/{shopKey})',
        },
        {
          src: '/images/blog/line-setup/step-liff-member.jpg',
          alt: 'LIFF member app settings',
          caption: 'ตัวอย่าง LIFF สำหรับหน้าข้อมูลสมาชิก (/liff/{shopKey}/member)',
        },
        {
          src: '/images/blog/line-setup/step-richmenu-links.jpg',
          alt: 'Rich menu links for booking and member',
          caption: 'ตัวอย่าง Rich Menu 2 ปุ่ม: จองคิว และ ข้อมูลสมาชิก',
        },
      ],
    },
    sections: [
      {
        heading: '1) เตรียมค่าในระบบก่อนตั้งค่า LINE',
        body: [
          'เตรียมโดเมน production เช่น https://queuebooking.com และ shop_key ของร้าน เช่น SHOP-TTLS2P.',
          'ตรวจว่าระบบมี endpoint เหล่านี้: /api/line/webhook/{shopKey}, /liff/{shopKey}, /liff/{shopKey}/member.',
          'แนะนำใช้ LIFF 2 ตัวแยกกัน: ตัวจองคิว (booking) และตัวข้อมูลสมาชิก (member) เพื่อจัดการ scope และ URL ชัดเจน.',
        ],
      },
      {
        heading: '2) ตั้งค่า Messaging API และ Webhook',
        body: [
          'เข้า LINE Developers > Channel ของ OA > Messaging API แล้วคัดลอก Channel access token (long-lived) และ Channel secret มาใส่ระบบ.',
          'Webhook URL ให้ตั้งเป็น https://queuebooking.com/api/line/webhook/{shopKey}.',
          'เปิด Use webhook = ON และกด Verify ต้องผ่าน.',
          'แนะนำปิด Auto-reply ของ LINE Official Account Manager เพื่อไม่ชนกับข้อความจากระบบ.',
        ],
      },
      {
        heading: '3) ตั้งค่า LIFF สำหรับหน้า Booking',
        body: [
          'สร้าง LIFF app ชื่อเช่น queuebooking, Size = Full.',
          'Endpoint URL ตั้งเป็น https://queuebooking.com/liff/{shopKey}.',
          'Scopes แนะนำ: openid, profile, chat_message.write.',
          'นำ LIFF ID ไปใส่ในระบบที่ฟิลด์ LIFF Booking ID หรือค่า NEXT_PUBLIC_LIFF_BOOKING_ID.',
        ],
      },
      {
        heading: '4) ตั้งค่า LIFF สำหรับหน้าข้อมูลสมาชิก',
        body: [
          'สร้าง LIFF app อีกตัวชื่อเช่น queuemember, Size = Full.',
          'Endpoint URL ตั้งเป็น https://queuebooking.com/liff/{shopKey}/member.',
          'ใช้ scope เหมือนหน้า booking ได้ (openid, profile, chat_message.write).',
          'นำ LIFF ID ไปใส่ LIFF Member ID หรือ NEXT_PUBLIC_LIFF_MEMBER_ID.',
        ],
      },
      {
        heading: '5) ตั้งค่า LINE Login (ถ้าใช้แยกจาก Messaging API)',
        body: [
          'ถ้าบัญชีแยก Channel ให้สร้าง LINE Login Channel และเพิ่ม Callback URL ให้ตรงโดเมน production.',
          'ในระบบนี้สามารถใช้ flow LIFF เป็นหลักได้ แต่ถ้ามีหน้า login เพิ่ม ควรใช้ Channel สำหรับ login โดยเฉพาะ.',
          'ห้ามสลับ LIFF ID คนละ channel โดยไม่อัปเดต endpoint และ env เพราะจะเกิด invalid liff id.',
        ],
      },
      {
        heading: '6) ตั้งค่า Rich Menu ให้เปิด 2 หน้า',
        body: [
          'สร้าง Rich Menu ปุ่ม 1: จองคิว -> ลิงก์ https://liff.line.me/{LIFF_BOOKING_ID}.',
          'ปุ่ม 2: ข้อมูลสมาชิก -> ลิงก์ https://liff.line.me/{LIFF_MEMBER_ID}.',
          'กำหนดช่วงเวลาแสดงผล และ publish rich menu ให้ active กับ OA.',
          'ทดสอบจากมือถือใน LINE จริง: กดแต่ละปุ่มแล้วต้องเข้า endpoint ตามที่ตั้งไว้.',
        ],
      },
      {
        heading: '7) Checklist ป้องกันปัญหา Invalid LIFF ID',
        body: [
          'LIFF ID ในระบบต้องตรงกับ LIFF app ที่ตั้ง endpoint ไว้จริง.',
          'Endpoint URL ต้องตรง path เป๊ะ: booking = /liff/{shopKey}, member = /liff/{shopKey}/member.',
          'โดเมนต้องเป็น https และตรงกับที่ deploy จริง.',
          'ถ้าเพิ่งแก้ค่า env บน Vercel ต้อง Redeploy ก่อนทดสอบ.',
        ],
      },
      {
        heading: '8) ทดสอบ end-to-end หลังตั้งค่า',
        body: [
          'ลูกค้ากด Rich Menu > จองคิว > เลือกบริการ/วัน/เวลา > ยืนยัน.',
          'ระบบต้องส่งข้อความยืนยันกลับใน LINE และคิวต้องเข้า dashboard ฝั่งร้าน.',
          'ลูกค้ากด Rich Menu > ข้อมูลสมาชิก ต้องเห็นโปรไฟล์และประวัติคิวได้.',
        ],
      },
    ],
  },
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
