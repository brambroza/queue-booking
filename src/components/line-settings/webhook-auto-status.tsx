'use client';

/** Result of POST /api/line-settings/webhook-auto. */
export type WebhookAutoResult = {
  endpoint: string;
  previousEndpoint: string;
  skipped: boolean;
  active: boolean;
  test: { success: boolean; statusCode: number | null; message: string };
};

/**
 * Checklist for the automatic webhook setup: URL set, "Use webhook" on,
 * and LINE's test delivery.
 */
export function WebhookAutoStatus({ result }: { result: WebhookAutoResult }) {
  if (result.skipped) {
    return (
      <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
        <p>webhook ของ channel นี้ชี้ไปที่ระบบอื่นอยู่ ระบบจึงไม่ได้เปลี่ยนให้:</p>
        <code className="mt-1 block break-all text-xs">{result.previousEndpoint}</code>
        <p className="mt-1">ถ้าต้องการให้ LINE OA นี้ใช้กับระบบจองคิว กดปุ่ม &quot;ตั้งค่า Webhook ให้อัตโนมัติ&quot; ระบบอื่นจะไม่ได้รับข้อความจาก LINE อีก</p>
      </div>
    );
  }
  const rows = [
    { ok: true, text: `ตั้ง Webhook URL ใน LINE แล้ว: ${result.endpoint}` },
    ...(result.previousEndpoint && result.previousEndpoint.replace(/\/+$/, '') !== result.endpoint
      ? [{ ok: true, text: `URL เดิม: ${result.previousEndpoint}` }]
      : []),
    {
      ok: result.active,
      text: result.active
        ? 'เปิด "Use webhook" แล้ว'
        : 'ยังไม่ได้เปิด "Use webhook" — เข้า LINE OA Manager > ตั้งค่า > Messaging API แล้วเปิดสวิตช์ (LINE ไม่ให้เปิดผ่าน API)',
    },
    { ok: result.test.success, text: result.test.message },
  ];
  return (
    <ul className="mt-3 space-y-1.5 rounded-xl border border-slate-200 bg-white p-3 text-sm">
      {rows.map((r) => (
        <li key={r.text} className={r.ok ? 'text-emerald-700' : 'text-rose-700'}>
          {r.ok ? '✓' : '✕'} {r.text}
        </li>
      ))}
    </ul>
  );
}
