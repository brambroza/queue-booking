'use client';

import { useCallback, useEffect, useState } from 'react';

type QuotaState = {
  available: boolean;
  quota: { type: 'limited' | 'none'; limit: number | null; used: number } | null;
  checked_at: string | null;
  exhausted_at: string | null;
  paused: boolean;
};

/** "11 พ.ย. 14:05" in Bangkok time. */
function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/**
 * "โควตาข้อความ LINE" section of /portal/line-settings. Shows the OA's monthly
 * push cap and usage straight from LINE, flags when it is used up, and
 * explains which messages are free (replies) and which spend the cap (pushes).
 */
export function LineQuotaCard() {
  const [state, setState] = useState<QuotaState | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setBusy(true);
    try {
      const res = await fetch(`/api/line-settings/quota${refresh ? '?refresh=1' : ''}`, { cache: 'no-store' });
      const json = (await res.json().catch(() => ({}))) as { data?: QuotaState };
      if (!res.ok || !json.data) return setLoadError(true);
      setState(json.data);
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const shell = 'mt-4 max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm';

  if (loadError) {
    return (
      <section id="line-quota" className={`${shell} text-sm text-slate-600`}>
        โหลดโควตาข้อความ LINE ไม่สำเร็จ{' '}
        <button type="button" className="underline" onClick={() => void load()}>ลองใหม่</button>
      </section>
    );
  }
  if (!state) return <section id="line-quota" className={`${shell} text-sm text-slate-500`}>กำลังโหลด…</section>;
  if (!state.available) {
    return (
      <section id="line-quota" className={`${shell} text-sm text-slate-600`}>
        ตัวนับโควตาข้อความ LINE ยังไม่พร้อมใช้งาน (รอผู้ดูแลระบบอัปเดตฐานข้อมูล)
      </section>
    );
  }

  const q = state.quota;
  const pct = q && q.type === 'limited' && q.limit ? Math.min(100, Math.round((q.used / q.limit) * 100)) : null;
  const tone = state.paused || (pct !== null && pct >= 100) ? 'rose' : pct !== null && pct >= 80 ? 'amber' : 'emerald';
  const bar = tone === 'rose' ? 'bg-rose-500' : tone === 'amber' ? 'bg-amber-500' : 'bg-emerald-500';

  return (
    <section id="line-quota" className={`${shell} space-y-3`}>
      <div className="border-b border-slate-100 pb-3">
        <h3 className="text-sm font-semibold text-slate-800">โควตาข้อความ LINE ของร้าน (เดือนนี้)</h3>
        <p className="mt-1 text-xs text-slate-500">
          LINE OA ทุกแพ็กเกจส่งข้อความหาลูกค้าได้จำกัดต่อเดือน ข้อความที่ระบบ<strong>ส่งเอง</strong>ถึงลูกค้า (เรียกคิว เตือนคิว
          ใบเสร็จ ร้านยืนยัน/ยกเลิกคิว) นับโควตา ส่วนข้อความที่<strong>ตอบกลับ</strong>สิ่งที่ลูกค้าส่งมา (การ์ดยืนยัน+QR หลังจอง
          "ได้รับสลิปแล้ว" "เช็คคิวของฉัน") ไม่นับ
        </p>
      </div>

      {!q ? (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
          ยังอ่านโควตาจาก LINE ไม่ได้ — ตรวจ Channel Access Token ด้านบน แล้วกด "อ่านค่าใหม่"
        </p>
      ) : q.type === 'none' ? (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">แพ็กเกจนี้ไม่จำกัดจำนวนข้อความ · ใช้ไปแล้ว {q.used.toLocaleString('th-TH')} ข้อความ</p>
      ) : (
        <div className="space-y-2">
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-medium text-slate-800">
              ใช้ไป {q.used.toLocaleString('th-TH')} / {(q.limit ?? 0).toLocaleString('th-TH')} ข้อความ
            </span>
            <span className={`text-xs ${tone === 'rose' ? 'text-rose-700' : tone === 'amber' ? 'text-amber-700' : 'text-slate-500'}`}>{pct}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div className={`h-full ${bar}`} style={{ width: `${pct ?? 0}%` }} />
          </div>
        </div>
      )}

      {state.paused && (
        <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
          <p className="font-medium">โควตาหมดแล้ว — ร้านส่งข้อความหาลูกค้าทาง LINE ไม่ได้จนกว่าจะขึ้นเดือนใหม่หรือเพิ่มแพ็กเกจ</p>
          <p className="mt-1 text-xs">
            ลูกค้ายังจอง ดู QR และอัปโหลดสลิปในหน้า LIFF ได้ตามปกติ และยังได้รับการ์ดยืนยัน+QR หลังจองจาก LINE
            (ส่งเป็นการตอบกลับ ไม่ใช้โควตา) แต่จะไม่ได้ใบเสร็จ การเรียกคิว หรือการเตือนคิวทางแชท
            {state.exhausted_at ? ` · ตรวจพบเมื่อ ${formatTime(state.exhausted_at)}` : ''}
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn-outline" disabled={busy} onClick={() => void load(true)}>
          {busy ? 'กำลังอ่าน…' : 'อ่านค่าใหม่จาก LINE'}
        </button>
        <a className="btn-outline" href="https://manager.line.biz/" target="_blank" rel="noreferrer">
          เพิ่มแพ็กเกจที่ LINE Official Account Manager
        </a>
        {state.checked_at ? <span className="text-xs text-slate-500">อ่านล่าสุด {formatTime(state.checked_at)}</span> : null}
      </div>
    </section>
  );
}
