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
  service_name?: string | null;
  resource_name?: string | null;
} | null;

type Payload = {
  date: string;
  branches: Branch[];
  totals: { all_today: number; remaining_today: number };
  shop?: { demo_mode_enabled?: boolean; demo_business_type?: string | null; name?: string | null };
  now_serving: PersonQueue;
  next_two: PersonQueue[];
};

type TemplateId = 'restaurant' | 'meeting' | 'barber' | 'nail' | 'clinic';

const SIGNAGE_TEMPLATES: Array<{
  id: TemplateId;
  name: string;
  icon: string;
  desc: string;
  badge: string;
  theme: 'default' | 'restaurant' | 'clinic' | 'meeting' | 'nail';
}> = [
  { id: 'restaurant', name: 'ร้านอาหาร / บุฟเฟ่ต์', icon: '🍽️', desc: 'แสดงคิวโต๊ะ รองรับ Walk-in และจองล่วงหน้า', badge: 'รองรับ Walk-in', theme: 'restaurant' },
  { id: 'meeting', name: 'ห้องประชุม', icon: '🏢', desc: 'แสดงสถานะห้องประชุม ว่าง / ไม่ว่าง แบบ Real-time', badge: 'Real-time', theme: 'meeting' },
  { id: 'barber', name: 'ร้านตัดผม', icon: '✂️', desc: 'คิวช่างและเวลานัดหมาย อ่านจากจอได้ชัด', badge: 'เลือกช่างได้', theme: 'default' },
  { id: 'nail', name: 'ร้านทำเล็บ', icon: '💅', desc: 'รองรับหลายบริการและคิวต่อเนื่อง', badge: 'หลายบริการ', theme: 'nail' },
  { id: 'clinic', name: 'คลินิก / ความงาม', icon: '🏥', desc: 'รองรับหลายห้องและนัดหมายรายเวลา', badge: 'หลายห้อง', theme: 'clinic' },
];

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

function templateIcon(id: TemplateId) {
  if (id === 'restaurant') return '🍽️';
  if (id === 'meeting') return '🏢';
  if (id === 'barber') return '✂️';
  if (id === 'nail') return '💅';
  return '🏥';
}

function themeToken(mode: 'default' | 'restaurant' | 'clinic' | 'meeting' | 'nail') {
  if (mode === 'restaurant') return { accent: '#fb923c', accentSoft: 'rgba(251,146,60,.15)' };
  if (mode === 'clinic') return { accent: '#38bdf8', accentSoft: 'rgba(56,189,248,.15)' };
  if (mode === 'meeting') return { accent: '#a78bfa', accentSoft: 'rgba(167,139,250,.15)' };
  if (mode === 'nail') return { accent: '#f9a8d4', accentSoft: 'rgba(249,168,212,.15)' };
  return { accent: '#4ade80', accentSoft: 'rgba(74,222,128,.15)' };
}

function statusThai(status: string) {
  if (status === 'called') return 'กำลังเรียก';
  if (status === 'waiting') return 'รอ';
  if (status === 'serving' || status === 'in_service') return 'กำลังให้บริการ';
  if (status === 'completed') return 'เสร็จแล้ว';
  return status || '-';
}

export function QueueDisplayClient() {
  const { push } = useToast();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [branchId, setBranchId] = useState('');
  const [data, setData] = useState<Payload | null>(null);
  const [fullscreenMode, setFullscreenMode] = useState(false);
  const [layoutMode, setLayoutMode] = useState<'portrait' | 'landscape' | 'mobile'>('landscape');
  const [themeMode, setThemeMode] = useState<'default' | 'restaurant' | 'clinic' | 'meeting' | 'nail'>('default');
  const [clock, setClock] = useState('');
  const [thaiDateLabel, setThaiDateLabel] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateId | null>(null);
  const [calling, setCalling] = useState(false);

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

  async function callNextDemo() {
    setCalling(true);
    const res = await fetch('/api/demo-sandbox', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'call_next' }),
    });
    const json = await res.json();
    setCalling(false);
    if (!res.ok) return push(json.error ?? 'เรียกคิวไม่สำเร็จ', 'error');
    if (json.data?.called) push(`เรียกคิว ${json.data.queue_number} แล้ว`);
    else push('ไม่มีคิวรอเรียก');
    await load();
  }

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

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setClock(d.toLocaleTimeString('th-TH', { hour12: false }));
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    setThaiDateLabel(new Date().toLocaleDateString('th-TH'));
  }, []);

  const themeClass =
    themeMode === 'restaurant'
      ? 'from-orange-950 to-[#0a0f0a]'
      : themeMode === 'clinic'
        ? 'from-sky-950 to-[#0a0f0a]'
        : themeMode === 'meeting'
          ? 'from-violet-950 to-[#0a0f0a]'
          : themeMode === 'nail'
            ? 'from-pink-950 to-[#0a0f0a]'
            : 'from-emerald-950 to-[#0a0f0a]';
  const token = themeToken(themeMode);
  const queueList = [data?.now_serving, ...(data?.next_two ?? [])].filter(Boolean) as Exclude<PersonQueue, null>[];
  const showFullscreenMainBoard = fullscreenMode && layoutMode === 'landscape' && selectedTemplate !== 'meeting';

  if (!selectedTemplate) {
    return (
      <div className="min-h-screen bg-[#0a0f0a] p-6 text-[#e8f5e8] md:p-10">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 text-center">
            <p className="text-sm font-semibold tracking-[0.16em] text-[#7ea17e]">QUEUEBOOKING DIGITAL SIGNAGE</p>
            <h1 className="mt-2 text-4xl font-extrabold tracking-tight md:text-5xl">เลือก Template หน้าจอคิว</h1>
            <p className="mt-2 text-base text-[#9cb89c]">เลือกประเภทธุรกิจและรูปแบบการแสดงผลก่อนเข้าโหมด Signage</p>
          </div>

          <div className="mb-6 grid gap-3 rounded-2xl border border-[#1f2d1f] bg-[#111811] p-4 md:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block text-[#9cb89c]">Layout</span>
              <select className="input !border-[#2a3e2a] !bg-[#182018] !text-[#e8f5e8]" value={layoutMode} onChange={(e) => setLayoutMode(e.target.value as 'portrait' | 'landscape' | 'mobile')}>
                <option value="portrait">Portrait</option>
                <option value="landscape">Landscape</option>
                <option value="mobile">Mobile</option>
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-[#9cb89c]">วันที่แสดงผล</span>
              <input className="input !border-[#2a3e2a] !bg-[#182018] !text-[#e8f5e8]" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {SIGNAGE_TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                onClick={() => {
                  setThemeMode(tpl.theme);
                  setSelectedTemplate(tpl.id);
                }}
                className="rounded-2xl border border-[#2a3e2a] bg-[#111811] p-5 text-left transition hover:-translate-y-0.5 hover:border-[#4ade80]"
              >
                <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#182018] text-2xl">
                  {tpl.icon}
                </div>
                <h3 className="text-xl font-bold">{tpl.name}</h3>
                <p className="mt-1 text-sm text-[#9cb89c]">{tpl.desc}</p>
                <span className="mt-3 inline-flex rounded-full border border-[#2a3e2a] bg-[#182018] px-2.5 py-1 text-xs text-[#4ade80]">
                  {tpl.badge}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      className={`space-y-5 ${fullscreenMode ? `min-h-screen bg-gradient-to-b ${themeClass} p-3 md:p-5 text-[#e8f5e8]` : ''}`}
    >
      {!fullscreenMode ? (
      <section className="rounded-3xl border border-slate-200 bg-gradient-to-r from-white to-emerald-50/40 p-4 md:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-[0.14em] text-slate-400">QUEUE DISPLAY</p>
            <h2 className="text-xl font-semibold tracking-tight text-slate-900">Live Queue Board • {SIGNAGE_TEMPLATES.find((t) => t.id === selectedTemplate)?.name}</h2>
          </div>
          <p className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-500">
            Auto refresh every 15s
          </p>
        </div>
        {data?.shop?.demo_mode_enabled ? (
          <p className="mt-2 inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs text-amber-700">
            Demo Mode • {data.shop.demo_business_type ?? 'demo'}
          </p>
        ) : null}
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
          {data?.shop?.demo_mode_enabled ? (
            <button className="btn-outline" disabled={calling} onClick={() => void callNextDemo()}>
              {calling ? 'กำลังเรียก...' : 'เรียกคิวถัดไป'}
            </button>
          ) : null}
          <button className="btn-outline" onClick={() => setSelectedTemplate(null)}>เปลี่ยน Template</button>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Layout</span>
            <select className="input" value={layoutMode} onChange={(e) => setLayoutMode(e.target.value as 'portrait' | 'landscape' | 'mobile')}>
              <option value="portrait">Portrait</option>
              <option value="landscape">Landscape</option>
              <option value="mobile">Mobile</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Theme</span>
            <select className="input" value={themeMode} onChange={(e) => setThemeMode(e.target.value as 'default' | 'restaurant' | 'clinic' | 'meeting' | 'nail')}>
              <option value="default">Default</option>
              <option value="restaurant">Restaurant</option>
              <option value="clinic">Clinic</option>
              <option value="meeting">Meeting</option>
              <option value="nail">Nail</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Template</span>
            <select className="input" disabled>
              <option>Live Queue Board</option>
            </select>
          </label>
        </div>
      </section>
      ) : (
        <section className="rounded-2xl border border-[#1f2d1f] bg-[#111811] px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.14em] text-[#7ea17e]">Queue Display</p>
              <p className="text-sm font-semibold text-[#d9f0d9]">Digital Signage Mode</p>
            </div>
            <p className="font-mono text-xl text-[#4ade80]">{clock}</p>
            <div className="flex items-center gap-2">
              <button className="btn-outline !border-[#2a3e2a] !bg-[#182018] !text-[#9cb89c]" onClick={() => void load()}>เรียกคิวถัดไป ▶</button>
              <button className="btn-outline !border-[#2a3e2a] !bg-[#182018] !text-[#9cb89c]" onClick={() => void load()}>รีเฟรช</button>
              <button className="btn-outline !border-[#2a3e2a] !bg-[#182018] !text-[#9cb89c]" onClick={() => void toggleFullscreen()}>Exit Fullscreen</button>
              <button className="btn-outline !border-[#2a3e2a] !bg-[#182018] !text-[#9cb89c]" onClick={() => setSelectedTemplate(null)}>← กลับ</button>
            </div>
          </div>
        </section>
      )}

      {fullscreenMode && layoutMode === 'mobile' ? (
        <section className="mx-auto max-w-xl space-y-4">
          <article className="rounded-3xl border border-[#2a3e2a] bg-[#111811] p-5 text-center">
            <p className="text-3xl font-bold">{templateIcon(selectedTemplate)} {SIGNAGE_TEMPLATES.find((t) => t.id === selectedTemplate)?.name}</p>
            <p className="mt-1 text-[#9cb89c]">วันพฤหัสบดีที่ {thaiDateLabel || '-'}</p>
          </article>
          <article className="rounded-3xl border border-[#2a3e2a] bg-[#111811] p-5 text-center">
            <p className="text-xl font-semibold" style={{ color: token.accent }}>📣 คิวปัจจุบัน</p>
            <p className="mt-1 font-mono text-7xl font-extrabold" style={{ color: token.accent, textShadow: `0 0 24px ${token.accent}` }}>
              {data?.now_serving?.queue_number ?? '-'}
            </p>
            <p className="mt-1 text-2xl font-bold">{data?.now_serving?.display_name ?? 'ยังไม่มีคิว'}</p>
            <p className="text-[#9cb89c]">รอคิวอยู่ {Math.max((data?.totals.remaining_today ?? 0) - 1, 0)} คิว</p>
          </article>
          <article className="rounded-3xl border border-[#2a3e2a] bg-[#111811] p-5">
            <p className="text-lg font-semibold text-[#9cb89c]">⏭ คิวถัดไป</p>
            <div className="mt-3 space-y-2">
              {(data?.next_two ?? []).length === 0 ? (
                <p className="text-[#9cb89c]">ยังไม่มีคิวถัดไป</p>
              ) : (data?.next_two ?? []).map((q) => q ? (
                <div key={q.booking_id} className="grid grid-cols-[100px_1fr_70px] items-center rounded-xl bg-[#182018] px-3 py-2">
                  <span className="font-mono text-4xl font-black">{q.queue_number}</span>
                  <span className="truncate text-lg">{q.display_name}</span>
                  <span className="text-right text-[#9cb89c]">{q.start_time}</span>
                </div>
              ) : null)}
            </div>
          </article>
          <p className="pb-2 text-center text-sm text-[#5a7a5a]">ขอบคุณที่ใช้บริการ 😊 • QueueBooking LINE</p>
        </section>
      ) : null}

      {fullscreenMode && selectedTemplate === 'meeting' && layoutMode !== 'mobile' ? (
        <section className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            {queueList.map((q, idx) => (
              <article key={q.booking_id} className="rounded-2xl border border-[#2a3e2a] bg-[#111811] p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-3xl font-bold">ห้องประชุม {idx + 1}</h3>
                  <span className="rounded-full border px-3 py-1 text-sm" style={{ borderColor: token.accent, color: token.accent }}>
                    {idx === 0 ? 'กำลังใช้งาน' : 'จองแล้ว'}
                  </span>
                </div>
                <p className="mt-1 text-[#9cb89c]">ความจุ {6 + idx * 2} ที่นั่ง</p>
                <div className="mt-4 rounded-xl bg-[#182018] p-3">
                  <p className="text-xl font-semibold">{q.display_name}</p>
                  <p className="mt-1 font-mono text-lg">{q.start_time}</p>
                </div>
              </article>
            ))}
            {queueList.length === 0 ? <p className="text-[#9cb89c]">ยังไม่มีข้อมูลห้องประชุม</p> : null}
          </div>
        </section>
      ) : null}

      {showFullscreenMainBoard ? (
      <section className="grid min-h-[calc(100vh-120px)] gap-4 md:grid-cols-[1fr_1.05fr]">
        <article className="flex h-full flex-col rounded-3xl border border-[#2a3e2a] bg-[#0c150f] p-5">
          <div className="rounded-2xl border border-[#243428] bg-[#101c14] p-4">
            <p className="text-lg font-semibold" style={{ color: token.accent }}>📣 คิวปัจจุบัน</p>
            <p className="mt-2 font-mono text-8xl font-black leading-none" style={{ color: token.accent, textShadow: `0 0 28px ${token.accent}` }}>
              {data?.now_serving?.queue_number ?? '-'}
            </p>
            <p className="mt-3 text-2xl font-semibold text-[#e8f5e8]">{data?.now_serving?.display_name ?? 'ยังไม่มีคิว'}</p>
            <div className="mt-3 rounded-full border px-4 py-2 text-lg font-semibold" style={{ borderColor: token.accent, backgroundColor: token.accentSoft, color: token.accent }}>
              {data?.now_serving?.start_time ?? '--:--'} • {statusThai(data?.now_serving?.status ?? '')}
            </div>
          </div>

          <div className="mt-auto grid grid-cols-2 gap-3 pt-4">
            <div className="rounded-2xl bg-[#101a13] p-4 text-center">
              <p className="text-5xl font-black text-[#f8fafc]">{data?.totals.all_today ?? 0}</p>
              <p className="text-sm text-[#7f9385]">คิวทั้งหมด</p>
            </div>
            <div className="rounded-2xl bg-[#101a13] p-4 text-center">
              <p className="text-5xl font-black" style={{ color: token.accent }}>{data?.totals.remaining_today ?? 0}</p>
              <p className="text-sm text-[#7f9385]">คงเหลือ</p>
            </div>
            <div className="rounded-2xl bg-[#101a13] p-4 text-center">
              <p className="text-5xl font-black text-[#7f9385]">0</p>
              <p className="text-sm text-[#7f9385]">เสร็จแล้ว</p>
            </div>
            <div className="rounded-2xl bg-[#101a13] p-4 text-center">
              <p className="text-5xl font-black text-[#fbbf24]">{Math.max((data?.totals.remaining_today ?? 0) - 1, 0)}</p>
              <p className="text-sm text-[#7f9385]">รอคิว</p>
            </div>
          </div>
        </article>

        <article className="rounded-3xl border border-[#2a3e2a] bg-[#0c150f] p-5">
          <p className="mb-3 text-lg font-semibold text-[#9cb89c]">📋 รายการคิว</p>
          <div className="space-y-2">
            {queueList.length === 0 ? (
              <p className="text-[#9cb89c]">ยังไม่มีคิว</p>
            ) : queueList.map((q, idx) => (
              <div
                key={q.booking_id}
                className="grid grid-cols-[110px_1fr_90px_100px] items-center gap-3 rounded-xl border border-[#1f2d1f] bg-[#111b14] px-4 py-3"
                style={idx === 0 ? { borderColor: token.accent, backgroundColor: token.accentSoft } : undefined}
              >
                <p className="font-mono text-4xl font-black" style={idx === 0 ? { color: token.accent } : undefined}>{q.queue_number}</p>
                <p className="truncate text-xl text-[#e8f5e8]">{q.display_name}</p>
                <p className="text-right text-lg text-[#8aa08f]">{q.start_time}</p>
                <p className="text-right">
                  <span className="rounded-full border border-[#4a5e4e] px-3 py-1 text-sm text-[#fcd34d]">{idx === 0 ? 'กำลังเรียก' : 'รอ'}</span>
                </p>
              </div>
            ))}
          </div>
        </article>
      </section>
      ) : null}

      {(!fullscreenMode || layoutMode !== 'mobile') && !(fullscreenMode && selectedTemplate === 'meeting' && layoutMode !== 'mobile') && !showFullscreenMainBoard ? (
      <div className={`grid gap-4 ${layoutMode === 'portrait' ? 'grid-cols-1' : 'md:grid-cols-2'}`}>
        <article className={`rounded-3xl border p-6 shadow-sm ${fullscreenMode ? 'border-[#2a3e2a] bg-[#111811]' : 'border-slate-200 bg-white'}`}>
          <p className={`text-sm ${fullscreenMode ? 'text-[#9cb89c]' : 'text-slate-500'}`}>คิวทั้งหมดวันนี้</p>
          <p className={`mt-2 text-5xl font-bold tracking-tight ${fullscreenMode ? 'font-mono text-[#e8f5e8]' : 'text-slate-900'}`}>{data?.totals.all_today ?? 0}</p>
        </article>
        <article className={`rounded-3xl border p-6 shadow-sm ${fullscreenMode ? 'border-[#2a3e2a] bg-[#111811]' : 'border-emerald-200 bg-emerald-50/50'}`}>
          <p className={`text-sm ${fullscreenMode ? 'text-[#9cb89c]' : 'text-slate-500'}`}>คิวคงเหลือวันนี้</p>
          <p className={`mt-2 text-5xl font-bold tracking-tight ${fullscreenMode ? 'font-mono text-[#4ade80]' : 'text-emerald-700'}`}>{data?.totals.remaining_today ?? 0}</p>
        </article>
      </div>
      ) : null}

      {layoutMode !== 'mobile' && !(fullscreenMode && selectedTemplate === 'meeting') && !showFullscreenMainBoard ? (
      <article className={`overflow-hidden rounded-3xl border p-0 shadow-sm ${fullscreenMode ? 'border-[#2a3e2a] bg-[#111811]' : 'border-slate-200 bg-white'}`}>
        <div className={`${fullscreenMode ? 'bg-[#182018]' : 'bg-[#4FA56A]'} px-6 py-4 ${fullscreenMode ? 'text-[#4ade80]' : 'text-white'}`}>
          <p className={`text-xs font-semibold tracking-[0.14em] ${fullscreenMode ? 'text-[#7ea17e]' : 'text-white/85'}`}>NOW CALLING</p>
          <h3 className="text-xl font-bold">เชิญคิวปัจจุบัน</h3>
        </div>
        <div className="p-6">
        {!data?.now_serving ? (
          <p className={`mt-3 text-lg ${fullscreenMode ? 'text-[#9cb89c]' : 'text-slate-500'}`}>ยังไม่มีคิวในขณะนี้</p>
        ) : (
          <div className={`mt-4 flex items-center gap-4 rounded-2xl border p-4 ${fullscreenMode ? 'border-[#315231] bg-[#182018]' : 'border-emerald-200 bg-emerald-50/40'} ${layoutMode === 'portrait' ? 'justify-center text-center flex-col' : ''}`}>
            <Avatar name={data.now_serving.display_name} url={data.now_serving.avatar_url} />
            <div>
              <p className={`text-5xl font-bold tracking-tight ${fullscreenMode ? 'font-mono text-[#4ade80]' : 'text-slate-900'}`}>{data.now_serving.queue_number}</p>
              <p className={`text-lg font-medium ${fullscreenMode ? 'text-[#e8f5e8]' : 'text-slate-800'}`}>{data.now_serving.display_name}</p>
              <p className={`text-sm ${fullscreenMode ? 'text-[#9cb89c]' : 'text-slate-500'}`}>เวลา {data.now_serving.start_time} • {data.now_serving.status}</p>
              {data.now_serving.service_name ? <p className={`text-sm ${fullscreenMode ? 'text-[#9cb89c]' : 'text-slate-600'}`}>{data.now_serving.service_name}</p> : null}
              {data.now_serving.resource_name ? <p className={`text-sm ${fullscreenMode ? 'text-[#9cb89c]' : 'text-slate-600'}`}>Resource: {data.now_serving.resource_name}</p> : null}
            </div>
          </div>
        )}
        </div>
      </article>
      ) : null}

      {layoutMode !== 'mobile' && !(fullscreenMode && selectedTemplate === 'meeting' ) && !showFullscreenMainBoard ? (
      <article className={`overflow-hidden rounded-3xl border p-0 shadow-sm ${fullscreenMode ? 'border-[#2a3e2a] bg-[#111811]' : 'border-slate-200 bg-white'}`}>
        <div className={`${fullscreenMode ? 'bg-[#182018]' : 'bg-[#EAF7EF]'} px-6 py-4`}>
          <p className={`text-xs font-semibold tracking-[0.14em] ${fullscreenMode ? 'text-[#7ea17e]' : 'text-[#2B6A3F]'}`}>NEXT QUEUES</p>
          <h3 className={`text-lg font-semibold ${fullscreenMode ? 'text-[#d9f0d9]' : 'text-[#2B6A3F]'}`}>คิวถัดไป</h3>
        </div>
        <div className="p-6">
        <div className={`mt-4 grid gap-3 ${layoutMode === 'landscape' ? 'md:grid-cols-2' : 'grid-cols-1'}`}>
          {(data?.next_two ?? []).length === 0 ? (
            <p className={`${fullscreenMode ? 'text-[#9cb89c]' : 'text-slate-500'}`}>ยังไม่มีคิวถัดไป</p>
          ) : (
            (data?.next_two ?? []).map((q) => (
              q ? (
                <div key={q.booking_id} className={`rounded-2xl border p-4 transition ${
                  fullscreenMode
                    ? 'border-[#2a3e2a] bg-[#182018] hover:border-[#365036]'
                    : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white'
                }`}>
                  <div className="flex items-center gap-3">
                    <Avatar name={q.display_name} url={q.avatar_url} />
                    <div>
                      <p className={`text-3xl font-bold tracking-tight ${fullscreenMode ? 'font-mono text-[#e8f5e8]' : 'text-slate-900'}`}>{q.queue_number}</p>
                      <p className={`text-sm font-medium ${fullscreenMode ? 'text-[#d9f0d9]' : 'text-slate-700'}`}>{q.display_name}</p>
                      <p className={`text-xs ${fullscreenMode ? 'text-[#9cb89c]' : 'text-slate-500'}`}>เวลา {q.start_time}</p>
                      {q.resource_name ? <p className={`text-xs ${fullscreenMode ? 'text-[#9cb89c]' : 'text-slate-500'}`}>{q.resource_name}</p> : null}
                    </div>
                  </div>
                </div>
              ) : null
            ))
          )}
        </div>
        </div>
      </article>
      ) : null}

      {!fullscreenMode && loading ? <p className="text-xs text-slate-500">กำลังโหลดข้อมูลหน้าจอคิว...</p> : null}
      {fullscreenMode ? (
        <p className="text-center text-xs text-[#5a7a5a]">Auto refresh every 15s • Queue Display</p>
      ) : null}
    </div>
  );
}
