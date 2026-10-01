import { blogPosts } from '@/components/public/blog-content';
import { pricingPlans } from '@/components/public/content';

/**
 * llms.txt for AI search engines. Facts here must match the live product and
 * the pricing list; prices are read from `pricingPlans` so they cannot drift.
 */
export async function GET() {
  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://queuebooking.com';
  const plans = pricingPlans.map(
    (p) => `- ${p.name}: ${p.price}${p.period} — ${p.items.join(', ')}`,
  );
  const posts = blogPosts.map((p) => `- [${p.title}](${base}/blog/${p.slug}): ${p.description}`);

  const body = [
    '# QueueBooking LINE',
    '',
    '> ระบบจองคิวผ่าน LINE OA สำหรับธุรกิจบริการไทย ลูกค้าจองในแอป LINE ได้เลยโดยไม่ต้องโหลดแอปใหม่ ร้านจัดการคิวทุกสาขาจากหลังบ้านเดียว พัฒนาโดย GoAlong Co., Ltd.',
    '',
    `Website: ${base}`,
    '',
    '## Core Pages',
    `- Landing: ${base}/`,
    `- Pricing: ${base}/pricing`,
    `- Contact: ${base}/contact`,
    `- Use Cases: ${base}/use-cases`,
    `- PromptPay payment: ${base}/features/promptpay-payment`,
    `- Blog: ${base}/blog`,
    `- English: ${base}/en`,
    '',
    '## Key Facts',
    '- ลูกค้าจองผ่านหน้าจองใน LINE (LIFF) จาก Rich Menu หรือแชทของ LINE OA ร้าน ไม่ต้องโหลดแอป',
    '- แสดงเฉพาะช่องเวลาที่ยังว่าง กันจองเกินจำนวนคิวต่อช่องเวลาอัตโนมัติ',
    '- รูปแบบคิว: นัดเวลาแน่นอน, รับเป็นรอบ, ต้องให้ร้านอนุมัติก่อน, walk-in หน้าร้าน',
    '- เตือนนัดผ่าน LINE อัตโนมัติ ตั้งได้ 15 นาที ถึง 1 วันก่อนถึงคิว',
    '- ลูกค้ายกเลิกคิวเอง และกด "ฉันมาถึงแล้ว" ในวันนัดได้จาก LINE',
    '- จอแสดงคิวเปิดผ่านเบราว์เซอร์บนทีวีที่มีอยู่ ไม่ต้องซื้อตู้กดบัตรคิว มี 11 รูปแบบ',
    '- รับชำระล่วงหน้าผ่าน PromptPay QR / แอปธนาคาร (Omise) หรือโอนแนบสลิป; ระบบอ่าน QR บนสลิปและเตือนสลิปซ้ำ แต่ไม่อนุมัติยอดจากรูปสลิปเพียงอย่างเดียว',
    '- ตัวสร้าง Rich Menu ตามประเภทธุรกิจ เผยแพร่ไป LINE OA ได้จากระบบ',
    '- หลายร้าน หลายสาขา สิทธิ์พนักงานตามบทบาท กล่องแชท LINE รวม ซิงก์ Google Calendar',
    '- รายงานยอดคิว ชั่วโมงขายดี ต่อพนักงาน/สาขา ส่งออก PDF และ CSV',
    '- หลังสมัคร ระบบสร้างสาขา บริการ และเวลาทำการเริ่มต้นให้ทันที; เชื่อม LINE OA ประมาณ 15–30 นาที',
    '',
    '## Pricing (THB, ไม่รวมค่าส่งข้อความ LINE, ไม่ผูกสัญญา)',
    ...plans,
    '',
    '## Target Industries',
    '- ร้านตัดผม, ร้านทำเล็บ, คลินิก, ร้านอาหาร/บุฟเฟ่ต์, สนามแบดมินตัน/เทนนิส/BB Gun, ห้องประชุม, ศูนย์บริการ, ร้านซ่อม, หน่วยงานที่มีคิวหน้าเคาน์เตอร์',
    '',
    '## Articles',
    ...posts,
  ].join('\n');

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
