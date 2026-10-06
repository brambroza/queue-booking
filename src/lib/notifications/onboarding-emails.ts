import { escapeHtml } from '@/lib/notifications/sales-email';

/** The two onboarding emails a super_admin can send from the shop list. */
export const ONBOARDING_EMAIL_KINDS = ['setup_guide', 'go_live'] as const;
export type OnboardingEmailKind = (typeof ONBOARDING_EMAIL_KINDS)[number];

/** Support details printed in both emails. One place, so a number change is one edit. */
export const SUPPORT_CONTACT = {
  line: '@queuebooking',
  phone: '085-608-3298',
  emailPrimary: 'amnart.gl@gmail.com',
  emailSecondary: 'info@goalong.co.th',
  website: 'https://queuebooking.com',
} as const;

export type BuiltEmail = { subject: string; html: string; text: string };

const BRAND = '#0e9f5a';
const BRAND_DEEP = '#0a6b3d';

/** Wraps paragraphs in the shared card layout. Table-based and inline-styled for mail clients. */
function layout(innerHtml: string): string {
  return `<!doctype html>
<html lang="th"><body style="margin:0;padding:0;background:#f1f5f2;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f2;padding:24px 12px;">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden;font-family:'Sarabun','Noto Sans Thai',Tahoma,Arial,sans-serif;color:#14211a;">
    <tr><td style="background:${BRAND_DEEP};padding:20px 28px;color:#ffffff;font-size:18px;font-weight:700;">QueueBooking <span style="font-weight:400;opacity:.85;font-size:14px;">ระบบจองคิวผ่าน LINE OA</span></td></tr>
    <tr><td style="padding:28px;font-size:16px;line-height:1.7;">${innerHtml}</td></tr>
    <tr><td style="background:#f6faf7;padding:16px 28px;font-size:13px;color:#5b6b62;border-top:1px solid #dbe5de;">QueueBooking by GO Along Co., Ltd. · <a href="${SUPPORT_CONTACT.website}" style="color:${BRAND};text-decoration:none;">queuebooking.com</a></td></tr>
  </table>
</td></tr></table></body></html>`;
}

const p = (html: string) => `<p style="margin:0 0 14px;">${html}</p>`;

function contactBox(rows: Array<[string, string]>): string {
  const lines = rows
    .map(([label, value]) => `<tr><td style="padding:3px 14px 3px 0;color:#5b6b62;white-space:nowrap;">${escapeHtml(label)}</td><td style="padding:3px 0;font-weight:700;">${escapeHtml(value)}</td></tr>`)
    .join('');
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="background:#f1f7f3;border-radius:10px;padding:12px 16px;margin:4px 0 18px;width:100%;"><tr><td><table role="presentation" cellpadding="0" cellspacing="0">${lines}</table></td></tr></table>`;
}

/**
 * Email 1, sent after sign-up while LINE OA is still not connected: a nudge to
 * start setup, with the LINE OA setup guide attached.
 *
 * @param input.ownerName - Greeting name; falls back to a neutral word upstream.
 */
export function buildSetupGuideEmail(input: { ownerName: string }): BuiltEmail {
  const owner = escapeHtml(input.ownerName);
  const html = layout(
    [
      p(`เรียนคุณ ${owner},`),
      p('ขอขอบคุณที่ลงทะเบียนใช้งาน QueueBooking ระบบจองคิวผ่าน LINE OA ครับ 🎉'),
      p('ขณะนี้บัญชีของท่านพร้อมใช้งานแล้ว แต่จากข้อมูลในระบบพบว่ายังไม่ได้ดำเนินการตั้งค่าเชื่อมต่อกับ LINE OA จึงขอแนะนำขั้นตอนเริ่มต้นเพื่อให้สามารถเปิดรับการจองคิวได้อย่างรวดเร็ว'),
      `<table role="presentation" cellpadding="0" cellspacing="0" style="background:#e4f5ec;border-radius:10px;margin:0 0 18px;width:100%;"><tr><td style="padding:14px 16px;font-size:15px;"><b>ไฟล์แนบ:</b> คู่มือตั้งค่า LINE OA ทีละขั้นตอน (PDF) ใช้เวลาตั้งค่าประมาณ 30–45 นาที</td></tr></table>`,
      p('หากต้องการให้ทีมงานช่วยแนะนำการตั้งค่าหรือการใช้งาน สามารถติดต่อเราได้โดยตรง'),
      contactBox([
        ['อีเมล', SUPPORT_CONTACT.emailPrimary],
        ['โทร', SUPPORT_CONTACT.phone],
        ['LINE', SUPPORT_CONTACT.line],
      ]),
      p('ขอบพระคุณที่ไว้วางใจ QueueBooking เราหวังเป็นอย่างยิ่งว่าจะได้เป็นส่วนหนึ่งในการช่วยให้ธุรกิจของท่านจัดการคิวและนัดหมายได้อย่างมีประสิทธิภาพมากยิ่งขึ้น'),
      p('ขอแสดงความนับถือ<br><b>QueueBooking Team</b><br><a href="https://queuebooking.com" style="color:#0e9f5a;">https://queuebooking.com</a>'),
    ].join(''),
  );

  const text = [
    `เรียนคุณ ${input.ownerName},`,
    '',
    'ขอขอบคุณที่ลงทะเบียนใช้งาน QueueBooking ระบบจองคิวผ่าน LINE OA ครับ',
    '',
    'ขณะนี้บัญชีของท่านพร้อมใช้งานแล้ว แต่จากข้อมูลในระบบพบว่ายังไม่ได้ดำเนินการตั้งค่าเชื่อมต่อกับ LINE OA จึงขอแนะนำขั้นตอนเริ่มต้นเพื่อให้สามารถเปิดรับการจองคิวได้อย่างรวดเร็ว',
    'ดูขั้นตอนทั้งหมดในไฟล์แนบ (คู่มือตั้งค่า LINE OA)',
    '',
    'หากต้องการให้ทีมงานช่วยแนะนำการตั้งค่าหรือการใช้งาน สามารถติดต่อเราได้โดยตรง',
    `อีเมล: ${SUPPORT_CONTACT.emailPrimary}`,
    `โทร: ${SUPPORT_CONTACT.phone}`,
    `LINE: ${SUPPORT_CONTACT.line}`,
    '',
    'ขอบพระคุณที่ไว้วางใจ QueueBooking เราหวังเป็นอย่างยิ่งว่าจะได้เป็นส่วนหนึ่งในการช่วยให้ธุรกิจของท่านจัดการคิวและนัดหมายได้อย่างมีประสิทธิภาพมากยิ่งขึ้น',
    '',
    'ขอแสดงความนับถือ',
    'QueueBooking Team',
    SUPPORT_CONTACT.website,
  ].join('\n');

  return { subject: 'QueueBooking ระบบจองคิวผ่าน LINE OA', html, text };
}

/**
 * Email 2, sent once all five setup steps are done and the shop has left the
 * trial (demo) mode: it can take real customers.
 *
 * @param input.ownerName - Greeting name.
 * @param input.shopName - Shop shown in the subject and body.
 */
export function buildGoLiveEmail(input: { ownerName: string; shopName: string }): BuiltEmail {
  const owner = escapeHtml(input.ownerName);
  const shop = escapeHtml(input.shopName);
  const html = layout(
    [
      p(`เรียน คุณ ${owner},`),
      p('ขอบคุณที่เลือกใช้ QueueBooking ระบบจองคิวผ่าน LINE OA ครับ'),
      p(`จากที่ท่านได้เชื่อมต่อ LINE OA และทดสอบการจองคิวเรียบร้อยแล้ว ทีมงานได้ปิดโหมดทดลอง (Demo) ให้แล้ว ตอนนี้ระบบของ <b>${shop}</b> พร้อมรับคิวจากลูกค้าจริงได้ทันที`),
      p('หากต้องการปรับแก้ข้อมูลหรือพบปัญหาระหว่างใช้งาน ติดต่อทีมงานได้ทาง'),
      contactBox([
        ['LINE OA', SUPPORT_CONTACT.line],
        ['โทร', SUPPORT_CONTACT.phone],
        ['อีเมล', `${SUPPORT_CONTACT.emailPrimary} , ${SUPPORT_CONTACT.emailSecondary}`],
      ]),
      p(`ขอให้การเปิดรับคิวของ ${shop} ราบรื่นครับ`),
      p('ขอแสดงความนับถือ<br><b>อำนาจ กองเพชร</b><br>QueueBooking by GO Along Co., Ltd.<br><a href="https://queuebooking.com" style="color:#0e9f5a;">https://queuebooking.com</a>'),
    ].join(''),
  );

  const text = [
    `เรียน คุณ ${input.ownerName},`,
    '',
    'ขอบคุณที่เลือกใช้ QueueBooking ระบบจองคิวผ่าน LINE OA ครับ',
    '',
    `จากที่ท่านได้เชื่อมต่อ LINE OA และทดสอบการจองคิวเรียบร้อยแล้ว ทีมงานได้ปิดโหมดทดลอง (Demo) ให้แล้ว ตอนนี้ระบบของ ${input.shopName} พร้อมรับคิวจากลูกค้าจริงได้ทันที`,
    '',
    'หากต้องการปรับแก้ข้อมูลหรือพบปัญหาระหว่างใช้งาน ติดต่อทีมงานได้ทาง',
    `LINE OA: ${SUPPORT_CONTACT.line}`,
    `โทร: ${SUPPORT_CONTACT.phone}`,
    `อีเมล: ${SUPPORT_CONTACT.emailPrimary} , ${SUPPORT_CONTACT.emailSecondary}`,
    '',
    `ขอให้การเปิดรับคิวของ ${input.shopName} ราบรื่นครับ`,
    '',
    'ขอแสดงความนับถือ',
    'อำนาจ กองเพชร',
    'QueueBooking by GO Along Co., Ltd.',
    SUPPORT_CONTACT.website,
  ].join('\n');

  return { subject: `ระบบจองคิว QueueBooking ของ ${input.shopName} พร้อมใช้งานแล้ว`, html, text };
}
