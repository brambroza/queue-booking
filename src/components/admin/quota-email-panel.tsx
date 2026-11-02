'use client';

import { useEffect, useState } from 'react';
import { useToast } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/confirm-dialog';

/**
 * super_admin drawer section on /portal/shop-subscriptions: preview the
 * booking-quota emails for this shop and send one for real (to yourself as a
 * test, to the owner, or to the team) through `/api/admin/shop-subscriptions/quota-email`.
 */

type Threshold = 80 | 90 | 100;
type Audience = 'owner' | 'team';
type Recipient = 'me' | 'owner' | 'team';

type Preview = {
  subject: string;
  html: string;
  real_usage: number;
  real_limit: number | null;
  plan_code: string | null;
  sample_numbers: { used: number; limit: number };
  recipients: Record<Recipient, string | null>;
};

const THRESHOLDS: Threshold[] = [80, 90, 100];

/** Segmented control built from buttons; the active one is filled. */
function Segmented<T extends string | number>({
  id,
  value,
  options,
  onChange,
}: {
  id: string;
  value: T;
  options: Array<[T, string]>;
  onChange: (v: T) => void;
}) {
  return (
    <div id={id} role="radiogroup" className="inline-flex overflow-hidden rounded-lg border" style={{ borderColor: 'var(--line)' }}>
      {options.map(([v, label]) => (
        <button
          key={String(v)}
          type="button"
          role="radio"
          aria-checked={v === value}
          className="px-3 py-1.5 text-sm"
          style={v === value ? { background: 'var(--brand)', color: '#fff' } : { color: 'var(--text)' }}
          onClick={() => onChange(v)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function QuotaEmailPanel({ shopId, shopName }: { shopId: string; shopName: string }) {
  const { push } = useToast();
  const confirm = useConfirm();
  const [threshold, setThreshold] = useState<Threshold>(80);
  const [audience, setAudience] = useState<Audience>('owner');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    void (async () => {
      try {
        const res = await fetch('/api/admin/shop-subscriptions/quota-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ shop_id: shopId, threshold, audience, mode: 'preview' }),
        });
        const json = (await res.json().catch(() => ({}))) as { data?: Preview; error?: string };
        if (cancelled) return;
        if (!res.ok || !json.data) setError(json.error ?? 'โหลดตัวอย่างอีเมลไม่สำเร็จ');
        else setPreview(json.data);
      } catch {
        if (!cancelled) setError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shopId, threshold, audience]);

  async function send(recipient: Recipient) {
    const to = preview?.recipients[recipient];
    const label = recipient === 'me' ? 'ส่งทดสอบถึงฉัน' : recipient === 'owner' ? 'ส่งถึงเจ้าของร้าน' : 'ส่งถึงทีม';
    await confirm({
      tone: recipient === 'owner' ? 'warning' : 'primary',
      title: recipient === 'owner' ? 'ส่งอีเมลแจ้งโควต้าถึงเจ้าของร้านจริง?' : `${label}?`,
      description:
        recipient === 'owner'
          ? 'เจ้าของร้านจะได้รับอีเมลนี้จาก info@goalong.co.th ตัวเลขในอีเมลตั้งตามระดับที่เลือก ไม่ใช่การใช้งานจริงตอนนี้'
          : 'ส่งจาก info@goalong.co.th ผ่าน SMTP เดียวกับอีเมลแจ้งเตือนจริง',
      context: { primary: shopName, secondary: `${audience === 'owner' ? 'อีเมลเจ้าของร้าน' : 'อีเมลทีม'} · ${threshold}% → ${to ?? '-'}` },
      acknowledge: recipient === 'owner' ? 'ยืนยันว่าต้องการส่งถึงลูกค้าจริง' : undefined,
      confirmLabel: label,
      onConfirm: async () => {
        const res = await fetch('/api/admin/shop-subscriptions/quota-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ shop_id: shopId, threshold, audience, mode: 'send', recipient }),
        });
        const json = (await res.json().catch(() => ({}))) as { data?: { to?: string }; error?: string };
        if (!res.ok) throw new Error(json.error ?? 'ส่งอีเมลไม่สำเร็จ');
        push(`ส่งอีเมลถึง ${json.data?.to ?? to ?? 'ผู้รับ'} แล้ว`);
      },
    });
  }

  const r = preview?.recipients;
  return (
    <div className="mb-4 rounded-xl border p-3" style={{ borderColor: 'var(--line)', background: 'var(--surface-soft)' }}>
      <p className="mb-1 text-xs font-medium" style={{ color: 'var(--muted)' }}>
        อีเมลแจ้งโควต้าการจอง (ส่งจาก info@goalong.co.th)
      </p>
      <p className="mb-3 text-xs" style={{ color: 'var(--muted)' }}>
        ระบบส่งเองเมื่อการใช้งานข้าม 80% / 90% / 100% ตรงนี้ใช้ดูตัวอย่างและส่งด้วยมือ
      </p>

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Segmented id="quota-email-threshold" value={threshold} options={THRESHOLDS.map((t) => [t, `${t}%`])} onChange={setThreshold} />
        <Segmented
          id="quota-email-audience"
          value={audience}
          options={[
            ['owner', 'อีเมลเจ้าของร้าน'],
            ['team', 'อีเมลทีม GoAlong'],
          ]}
          onChange={setAudience}
        />
      </div>

      {preview ? (
        <p className="mb-2 text-xs" style={{ color: 'var(--muted)' }}>
          ตัวเลขในตัวอย่าง {preview.sample_numbers.used}/{preview.sample_numbers.limit} คิว · ใช้จริงเดือนนี้ {preview.real_usage}/
          {preview.real_limit ?? 'ไม่จำกัด'}
          {preview.real_limit === null ? ' (ใช้ 100 คิวเป็นตัวอย่าง)' : ''}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-lg border" style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}>
        <div className="border-b px-3 py-2 text-xs" style={{ borderColor: 'var(--line)', color: 'var(--muted)' }}>
          <div>จาก QueueBooking &lt;info@goalong.co.th&gt;</div>
          <div className="mt-0.5 text-sm font-medium" style={{ color: 'var(--text)' }}>
            {loading ? 'กำลังโหลดตัวอย่าง…' : error || preview?.subject}
          </div>
        </div>
        {preview && !error ? (
          <iframe title="ตัวอย่างอีเมล" srcDoc={preview.html} sandbox="" className="block w-full" style={{ height: 520, border: 0, opacity: loading ? 0.5 : 1 }} />
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="btn-primary" disabled={!preview || loading || !r?.me} onClick={() => void send('me')}>
          ส่งทดสอบถึงฉัน{r?.me ? ` (${r.me})` : ''}
        </button>
        {audience === 'owner' ? (
          <button type="button" className="btn-outline" disabled={!preview || loading || !r?.owner} onClick={() => void send('owner')}>
            {r?.owner ? `ส่งถึงเจ้าของร้าน (${r.owner})` : 'ไม่มีอีเมลเจ้าของร้าน'}
          </button>
        ) : (
          <button type="button" className="btn-outline" disabled={!preview || loading || !r?.team} onClick={() => void send('team')}>
            {r?.team ? `ส่งถึงทีม (${r.team})` : 'ยังไม่ได้ตั้ง SALES_NOTIFY_EMAIL'}
          </button>
        )}
      </div>
    </div>
  );
}
