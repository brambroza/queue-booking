/**
 * Emails for the monthly booking quota: one to the shop owner, one to the
 * GoAlong team. Pure builders (no I/O) so wording and escaping are tested.
 * Same card layout as the onboarding emails; sent from the SMTP sender
 * (info@goalong.co.th) by `sendCustomerEmail` / `sendSalesEmail`.
 */
import { escapeHtml } from '@/lib/notifications/sales-email';
import {
  EMAIL_BRAND,
  SUPPORT_CONTACT,
  contactBox,
  layout as emailLayout,
  p as emailParagraph,
  type BuiltEmail,
} from '@/lib/notifications/onboarding-emails';
import { quotaPeriodLabel, type QuotaAlertThreshold } from '@/lib/subscription/quota-alerts';

/** Plan ladder for the "suggested next plan" line. */
const PLAN_LADDER = ['starter', 'professional', 'business', 'enterprise'] as const;

const PLAN_LABEL: Record<string, string> = {
  starter: 'Starter',
  professional: 'Professional',
  business: 'Business',
  enterprise: 'Enterprise',
};

/** Display name of a plan code ("professional" → "Professional"). */
export function planLabel(code: string | null | undefined): string {
  if (!code) return 'Starter';
  return PLAN_LABEL[code] ?? code;
}

/** The plan above `code`, or null at the top / for an unknown code. */
export function nextPlanCode(code: string | null | undefined): string | null {
  const i = PLAN_LADDER.indexOf((code ?? 'starter') as (typeof PLAN_LADDER)[number]);
  if (i < 0 || i >= PLAN_LADDER.length - 1) return null;
  return PLAN_LADDER[i + 1];
}

export type QuotaEmailInput = {
  ownerName: string;
  shopName: string;
  shopKey?: string | null;
  threshold: QuotaAlertThreshold;
  used: number;
  limit: number;
  /** `yyyy-mm` of the quota month. */
  period: string;
  planCode: string | null;
  /** Base app URL; links are left out when it is not https. */
  appUrl?: string | null;
};

const WARN = '#b26a00';
const CRIT = '#b3261e';

function toneFor(threshold: QuotaAlertThreshold): string {
  if (threshold >= 100) return CRIT;
  if (threshold >= 90) return WARN;
  return EMAIL_BRAND;
}

function httpsBase(appUrl: string | null | undefined): string | null {
  return appUrl && /^https:\/\//.test(appUrl) ? appUrl.replace(/\/+$/, '') : null;
}

/** Table-based progress bar (mail clients ignore most CSS). */
function usageBar(used: number, limit: number, color: string): string {
  const pct = Math.max(2, Math.min(100, Math.round((used / limit) * 100)));
  const rest = 100 - pct;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-radius:999px;overflow:hidden;background:#e3ebe6;margin:6px 0 4px;"><tr>
<td width="${pct}%" style="background:${color};height:12px;font-size:0;line-height:0;">&nbsp;</td>${rest > 0 ? `<td width="${rest}%" style="height:12px;font-size:0;line-height:0;">&nbsp;</td>` : ''}
</tr></table>`;
}

/** Three-figure summary row: used / remaining / plan. */
function statRow(cells: Array<[string, string, string?]>): string {
  const tds = cells
    .map(
      ([label, value, color]) =>
        `<td style="padding:12px 10px;text-align:center;border-right:1px solid #dbe5de;"><div style="font-size:12px;color:#5b6b62;">${escapeHtml(label)}</div><div style="font-size:20px;font-weight:700;color:${color ?? '#14211a'};">${escapeHtml(value)}</div></td>`,
    )
    .join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6faf7;border:1px solid #dbe5de;border-radius:10px;margin:14px 0 18px;"><tr>${tds}</tr></table>`;
}

function button(href: string, label: string, color: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:4px 0 20px;"><tr><td style="background:${color};border-radius:10px;"><a href="${escapeHtml(href)}" style="display:inline-block;padding:12px 22px;color:#ffffff;font-weight:700;text-decoration:none;font-size:15px;">${escapeHtml(label)}</a></td></tr></table>`;
}

/**
 * Owner email when usage crosses 80 / 90 / 100 % of the month's booking quota.
 *
 * @param input - Shop, usage and plan; text fields are escaped here.
 */
export function buildOwnerQuotaEmail(input: QuotaEmailInput): BuiltEmail {
  const owner = escapeHtml(input.ownerName);
  const shop = escapeHtml(input.shopName);
  const month = quotaPeriodLabel(input.period);
  const remaining = Math.max(0, input.limit - input.used);
  const full = input.threshold >= 100;
  const tone = toneFor(input.threshold);
  const plan = planLabel(input.planCode);
  const next = nextPlanCode(input.planCode);
  const base = httpsBase(input.appUrl);
  const planUrl = base ? `${base}/portal/settings` : null;

  const headline = full
    ? `โควต้าการจองเดือน ${month} ของร้าน ${shop} ครบแล้ว`
    : `โควต้าการจองเดือน ${month} ของร้าน ${shop} ใช้ไปแล้ว ${input.threshold}%`;

  const consequence = full
    ? 'ตั้งแต่ตอนนี้ ลูกค้าจะ<b>ไม่สามารถจองคิวที่มีวันนัดในเดือนนี้เพิ่มได้</b> ทั้งผ่าน LINE และการสร้างคิวในระบบหลังร้าน จนกว่าจะปรับแพ็กเกจ คิวที่จองไว้แล้วยังใช้งานได้ตามปกติ'
    : `เหลืออีก <b>${remaining} คิว</b> ก่อนครบโควต้า เมื่อครบแล้วลูกค้าจะจองคิวที่มีวันนัดในเดือนนี้เพิ่มไม่ได้ เพื่อไม่ให้เสียโอกาสรับลูกค้า แนะนำให้ปรับแพ็กเกจก่อนโควต้าเต็ม`;

  const html = emailLayout(
    [
      `<div style="border-left:4px solid ${tone};padding:2px 0 2px 14px;margin:0 0 18px;font-size:18px;font-weight:700;color:${tone};">${headline}</div>`,
      emailParagraph(`เรียน คุณ${owner}`),
      emailParagraph(`ขอแจ้งสถานะการใช้งานโควต้าการจองของร้าน <b>${shop}</b> ประจำเดือน ${month} ดังนี้`),
      statRow([
        ['จองแล้ว', `${input.used} / ${input.limit}`, tone],
        ['คงเหลือ', `${remaining} คิว`],
        ['แพ็กเกจปัจจุบัน', plan],
      ]),
      usageBar(input.used, input.limit, tone),
      `<div style="font-size:12px;color:#5b6b62;margin:0 0 18px;">นับเฉพาะคิวที่มีวันนัดในเดือน ${month} · คิวของเดือนถัดไปนับโควต้าแยกใหม่</div>`,
      emailParagraph(consequence),
      next
        ? emailParagraph(`แพ็กเกจที่แนะนำ: <b>${escapeHtml(planLabel(next))}</b> รองรับจำนวนคิวต่อเดือนมากขึ้น ทีมงานพร้อมช่วยปรับให้ภายในวันทำการ`)
        : emailParagraph('ทีมงานพร้อมช่วยปรับโควต้าให้เหมาะกับปริมาณลูกค้าของร้าน'),
      planUrl ? button(planUrl, full ? 'ปรับแพ็กเกจเพื่อเปิดรับคิวต่อ' : 'ดูแพ็กเกจและการใช้งาน', tone === EMAIL_BRAND ? EMAIL_BRAND : tone) : '',
      emailParagraph('หากต้องการคำแนะนำหรือปรับแพ็กเกจ ติดต่อทีมงานได้ทาง'),
      contactBox([
        ['LINE OA', SUPPORT_CONTACT.line],
        ['โทร', SUPPORT_CONTACT.phone],
        ['อีเมล', SUPPORT_CONTACT.emailSecondary],
      ]),
      emailParagraph('ขอแสดงความนับถือ<br><b>QueueBooking Team</b><br>GO Along Co., Ltd.'),
      `<div style="font-size:12px;color:#8a978f;margin-top:8px;">อีเมลนี้ส่งอัตโนมัติเมื่อการใช้งานถึง 80%, 90% และ 100% ของโควต้า (ระดับละครั้งต่อเดือน)</div>`,
    ].join(''),
  );

  const text = [
    full ? `โควต้าการจองเดือน ${month} ของร้าน ${input.shopName} ครบแล้ว` : `โควต้าการจองเดือน ${month} ของร้าน ${input.shopName} ใช้ไปแล้ว ${input.threshold}%`,
    '',
    `เรียน คุณ${input.ownerName}`,
    '',
    `จองแล้ว: ${input.used} / ${input.limit} คิว`,
    `คงเหลือ: ${remaining} คิว`,
    `แพ็กเกจปัจจุบัน: ${plan}`,
    `(นับเฉพาะคิวที่มีวันนัดในเดือน ${month})`,
    '',
    full
      ? 'ลูกค้าจะไม่สามารถจองคิวที่มีวันนัดในเดือนนี้เพิ่มได้จนกว่าจะปรับแพ็กเกจ คิวที่จองไว้แล้วยังใช้งานได้ตามปกติ'
      : `เหลืออีก ${remaining} คิวก่อนครบโควต้า แนะนำให้ปรับแพ็กเกจก่อนโควต้าเต็ม`,
    next ? `แพ็กเกจที่แนะนำ: ${planLabel(next)}` : '',
    planUrl ? `ดูแพ็กเกจ: ${planUrl}` : '',
    '',
    `LINE OA: ${SUPPORT_CONTACT.line} · โทร: ${SUPPORT_CONTACT.phone} · อีเมล: ${SUPPORT_CONTACT.emailSecondary}`,
    '',
    'ขอแสดงความนับถือ',
    'QueueBooking Team',
    'GO Along Co., Ltd.',
  ]
    .filter((line, i, all) => line !== '' || all[i - 1] !== '')
    .join('\n');

  const subject = full
    ? `[QueueBooking] โควต้าการจองเดือน ${month} ของ ${input.shopName} ครบแล้ว`
    : `[QueueBooking] ${input.shopName} ใช้โควต้าการจองเดือน ${month} ไปแล้ว ${input.threshold}%`;
  return { subject, html, text };
}

export type AdminQuotaEmailInput = QuotaEmailInput & {
  ownerEmail: string | null;
  ownerPhone?: string | null;
  /** What happened to the owner email, shown so the team knows whether to call. */
  ownerEmailStatus: 'sent' | 'no_email' | 'failed';
  ownerLineStatus: 'sent' | 'not_linked' | 'failed';
};

/**
 * Internal email to the GoAlong team: a shop crossed a quota threshold — an
 * upgrade conversation to have now.
 */
export function buildAdminQuotaEmail(input: AdminQuotaEmailInput): BuiltEmail {
  const month = quotaPeriodLabel(input.period);
  const tone = toneFor(input.threshold);
  const next = nextPlanCode(input.planCode);
  const base = httpsBase(input.appUrl);
  const adminUrl = base ? `${base}/portal/shop-subscriptions` : null;
  const status = {
    sent: 'ส่งแล้ว',
    no_email: 'ไม่มีอีเมลในระบบ',
    failed: 'ส่งไม่สำเร็จ',
    not_linked: 'ยังไม่ได้เชื่อม',
  } as const;

  const rows: Array<[string, string]> = [
    ['ร้าน', `${input.shopName}${input.shopKey ? ` (${input.shopKey})` : ''}`],
    ['การใช้งาน', `${input.used} / ${input.limit} คิว (${input.threshold}%) · เดือน ${month}`],
    ['แพ็กเกจ', `${planLabel(input.planCode)}${next ? ` → แนะนำ ${planLabel(next)}` : ''}`],
    ['เจ้าของร้าน', input.ownerName],
    ['อีเมลเจ้าของ', `${input.ownerEmail ?? '-'} · ${status[input.ownerEmailStatus]}`],
    ['LINE เจ้าของ', status[input.ownerLineStatus]],
  ];
  if (input.ownerPhone) rows.push(['โทร', input.ownerPhone]);

  const table = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:7px 14px 7px 0;color:#5b6b62;white-space:nowrap;vertical-align:top;">${escapeHtml(label)}</td><td style="padding:7px 0;font-weight:600;">${escapeHtml(value)}</td></tr>`,
    )
    .join('');

  const html = emailLayout(
    [
      `<div style="border-left:4px solid ${tone};padding:2px 0 2px 14px;margin:0 0 18px;font-size:17px;font-weight:700;color:${tone};">${escapeHtml(input.shopName)} ใช้โควต้าการจองไปแล้ว ${input.threshold}%</div>`,
      usageBar(input.used, input.limit, tone),
      `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:14px 0 18px;font-size:15px;">${table}</table>`,
      emailParagraph(
        input.threshold >= 100
          ? 'ร้านนี้รับคิวของเดือนนี้เพิ่มไม่ได้แล้ว ควรติดต่อเจ้าของร้านวันนี้เพื่อปรับแพ็กเกจหรือเพิ่มโควต้า (override)'
          : 'ช่วงเวลาที่เหมาะกับการเสนออัปเกรด ร้านยังรับคิวได้ แต่จะเต็มในไม่ช้า',
      ),
      adminUrl ? button(adminUrl, 'เปิดหน้าแพ็กเกจร้าน', EMAIL_BRAND) : '',
      `<div style="font-size:12px;color:#8a978f;">บันทึกเป็น lead ใน Sales Inbox แล้ว (source quota_80)</div>`,
    ].join(''),
  );

  const text = [
    `${input.shopName} ใช้โควต้าการจองไปแล้ว ${input.threshold}%`,
    '',
    ...rows.map(([label, value]) => `${label}: ${value}`),
    '',
    adminUrl ? `หน้าแพ็กเกจร้าน: ${adminUrl}` : '',
  ].join('\n');

  return { subject: `[Quota ${input.threshold}%] ${input.shopName} · ${input.used}/${input.limit} คิว (${month})`, html, text };
}
