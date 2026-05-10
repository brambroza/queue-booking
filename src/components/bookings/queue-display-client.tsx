'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from '@/components/ui/toast';

type Branch = { id: string; branch_name: string; active: boolean };
type PersonQueue = {
  booking_id: string;
  queue_number: string;
  status: string;
  start_time: string;
  display_name: string;
  avatar_url: string | null;
} | null;

type Payload = {
  date: string;
  branches: Branch[];
  totals: { all_today: number; remaining_today: number };
  now_serving: PersonQueue;
  next_two: PersonQueue[];
};

function Avatar({ name, url }: { name: string; url?: string | null }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={name} className="h-16 w-16 rounded-full border border-slate-200 object-cover" />;
  }
  return (
    <div className="flex h-16 w-16 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-xl font-semibold text-slate-700">
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}

export function QueueDisplayClient() {
  const { push } = useToast();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [branchId, setBranchId] = useState('');
  const [data, setData] = useState<Payload | null>(null);
  const [fullscreenMode, setFullscreenMode] = useState(false);

  const load = useCallback(async () => {
    const qs = new URLSearchParams({ date });
    if (branchId) qs.set('branch_id', branchId);
    const res = await fetch(`/api/queue-display?${qs.toString()}`, { cache: 'no-store' });
    const json = await res.json();
    if (!res.ok) {
      push(json.error ?? 'โหลดหน้าจอคิวไม่สำเร็จ', 'error');
      return;
    }
    setData(json.data ?? null);
    if (!branchId && json.data?.branches?.[0]) setBranchId(json.data.branches[0].id);
    setLoading(false);
  }, [branchId, date, push]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const t = setInterval(() => { void load(); }, 15000);
    return () => clearInterval(t);
  }, [load]);

  async function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) {
        await rootRef.current?.requestFullscreen();
        setFullscreenMode(true);
      } else {
        await document.exitFullscreen();
        setFullscreenMode(false);
      }
    } catch {
      push('เปิด/ปิด fullscreen ไม่สำเร็จ', 'error');
    }
  }

  useEffect(() => {
    const onChange = () => setFullscreenMode(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  return (
    <div ref={rootRef} className={`space-y-6 ${fullscreenMode ? 'bg-[#f6f7f9] p-4 md:p-8 min-h-screen' : ''}`}>
      {!fullscreenMode ? (
      <section className="rounded-3xl border border-slate-200 bg-gradient-to-r from-white to-emerald-50/40 p-4 md:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-[0.14em] text-slate-400">QUEUE DISPLAY</p>
            <h2 className="text-xl font-semibold tracking-tight text-slate-900">Live Queue Board</h2>
          </div>
          <p className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-500">
            Auto refresh every 15s
          </p>
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">วันที่</span>
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">สาขา</span>
            <select className="input min-w-[240px]" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              <option value="">ทุกสาขา</option>
              {(data?.branches ?? []).map((b) => (
                <option key={b.id} value={b.id}>{b.branch_name}</option>
              ))}
            </select>
          </label>
          <button className="btn-outline" onClick={() => void load()}>Refresh</button>
          <button className="btn-primary" onClick={() => void toggleFullscreen()}>Fullscreen</button>
        </div>
      </section>
      ) : (
        <div className="flex justify-end">
          <button className="btn-outline" onClick={() => void toggleFullscreen()}>Exit Fullscreen</button>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">คิวทั้งหมดวันนี้</p>
          <p className="mt-2 text-5xl font-bold tracking-tight text-slate-900">{data?.totals.all_today ?? 0}</p>
        </article>
        <article className="rounded-3xl border border-emerald-200 bg-emerald-50/50 p-6 shadow-sm">
          <p className="text-sm text-slate-500">คิวคงเหลือวันนี้</p>
          <p className="mt-2 text-5xl font-bold tracking-tight text-emerald-700">{data?.totals.remaining_today ?? 0}</p>
        </article>
      </div>

      <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold tracking-[0.14em] text-slate-400">NOW SERVING</p>
        {!data?.now_serving ? (
          <p className="mt-3 text-lg text-slate-500">ยังไม่มีคิวในขณะนี้</p>
        ) : (
          <div className="mt-4 flex items-center gap-4 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4">
            <Avatar name={data.now_serving.display_name} url={data.now_serving.avatar_url} />
            <div>
              <p className="text-5xl font-bold tracking-tight text-slate-900">{data.now_serving.queue_number}</p>
              <p className="text-lg font-medium text-slate-800">{data.now_serving.display_name}</p>
              <p className="text-sm text-slate-500">เวลา {data.now_serving.start_time} • {data.now_serving.status}</p>
            </div>
          </div>
        )}
      </article>

      <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold tracking-[0.14em] text-slate-400">NEXT 2 QUEUES</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {(data?.next_two ?? []).length === 0 ? (
            <p className="text-slate-500">ยังไม่มีคิวถัดไป</p>
          ) : (
            (data?.next_two ?? []).map((q) => (
              q ? (
                <div key={q.booking_id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-slate-300 hover:bg-white">
                  <div className="flex items-center gap-3">
                    <Avatar name={q.display_name} url={q.avatar_url} />
                    <div>
                      <p className="text-3xl font-bold tracking-tight text-slate-900">{q.queue_number}</p>
                      <p className="text-sm font-medium text-slate-700">{q.display_name}</p>
                      <p className="text-xs text-slate-500">เวลา {q.start_time}</p>
                    </div>
                  </div>
                </div>
              ) : null
            ))
          )}
        </div>
      </article>

      {!fullscreenMode && loading ? <p className="text-xs text-slate-500">กำลังโหลดข้อมูลหน้าจอคิว...</p> : null}
    </div>
  );
}
