'use client';

import { useEffect, useMemo, useState } from 'react';
import { useToast } from '@/components/ui/toast';
import { formatDateDMY, getTodayISOInBangkok } from '@/lib/utils/date-format';

type Branch = { id: string; branch_name: string };
type Service = { id: string; service_name: string; duration_minutes: number };
type Slot = { slot_time: string; remaining_capacity: number };
type SlotMeta = {
  reason: 'ok' | 'holiday' | 'closed' | 'full';
  hint?: string;
};
type ShopMeta = { id: string; name: string; shop_key: string; liff_id?: string | null };
type MyBooking = {
  id: string;
  queue_number: string;
  booking_date: string;
  start_time: string;
  status: string;
  note?: string | null;
  branches?: { branch_name?: string } | null;
  services?: { service_name?: string } | null;
};

type UiTheme = {
  key: 'default' | 'nail' | 'clinic' | 'buffet' | 'meeting';
  accent: string;
  accentSoft: string;
  accentText: string;
  successTitle: string;
};
type ServiceKind = 'barber' | 'nail' | 'clinic' | 'buffet' | 'meeting' | 'default';
type ServiceCardMeta = { icon: string; subtitle: string };

type LiffApi = {
  init: (x: { liffId: string }) => Promise<void>;
  isLoggedIn: () => boolean;
  isInClient?: () => boolean;
  login: () => void;
  closeWindow?: () => void;
  sendMessages?: (messages: object[]) => Promise<void>;
  getProfile: () => Promise<{ userId: string; displayName: string; pictureUrl?: string }>;
};

function normalizeLiffId(input?: string | null): string {
  if (!input) return '';
  const raw = input.trim();
  const m = raw.match(/liff\.line\.me\/([^/?#]+)/);
  return m?.[1] ?? raw;
}

function isLikelyLiffId(v: string) {
  return /^[0-9]{6,}-[A-Za-z0-9_-]{4,}$/.test(v.trim());
}

function resolveLiffId(shopLiffId?: string | null) {
  const fromShop = normalizeLiffId(shopLiffId);
  if (isLikelyLiffId(fromShop)) return fromShop;
  const fromEnv = normalizeLiffId(process.env.NEXT_PUBLIC_LIFF_ID);
  if (isLikelyLiffId(fromEnv)) return fromEnv;
  return '';
}

function buildLiffOpenUrl(liffId: string, shopKey: string, tab: 'booking' | 'account') {
  const params = new URLSearchParams({ shop_key: shopKey, tab });
  return `https://liff.line.me/${encodeURIComponent(liffId)}?${params.toString()}`;
}

function getLiffCandidates(shopLiffId?: string | null, initialTab: 'booking' | 'account' = 'booking') {
  const fromShop = normalizeLiffId(shopLiffId);
  const fromEnv = normalizeLiffId(process.env.NEXT_PUBLIC_LIFF_ID);
  const fromMemberEnv = normalizeLiffId(process.env.NEXT_PUBLIC_LIFF_MEMBER_ID);
  const fromBookingEnv = normalizeLiffId(process.env.NEXT_PUBLIC_LIFF_BOOKING_ID);

  const ordered =
    initialTab === 'account'
      ? [fromMemberEnv, fromShop, fromEnv, fromBookingEnv]
      : [fromBookingEnv, fromShop, fromEnv, fromMemberEnv];

  const all = ordered.filter((v) => isLikelyLiffId(v));
  return Array.from(new Set(all));
}

async function ensureLiffLoaded(): Promise<LiffApi | null> {
  const w = window as Window & { liff?: LiffApi };
  if (w.liff) return w.liff;

  const existed = document.querySelector('script[data-liff-sdk="1"]') as HTMLScriptElement | null;
  if (!existed) {
    const s = document.createElement('script');
    s.src = 'https://static.line-scdn.net/liff/edge/2/sdk.js';
    s.async = true;
    s.dataset.liffSdk = '1';
    document.head.appendChild(s);
    await new Promise<void>((resolve, reject) => {
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Unable to load LIFF SDK'));
    });
  } else if (!(window as Window & { liff?: LiffApi }).liff) {
    await new Promise((r) => setTimeout(r, 300));
  }

  return (window as Window & { liff?: LiffApi }).liff ?? null;
}

function bookingStatusStyle(status: string) {
  if (status === 'completed') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (status === 'serving') return 'bg-cyan-50 text-cyan-700 border-cyan-200';
  if (status === 'waiting') return 'bg-amber-50 text-amber-700 border-amber-200';
  if (status === 'confirmed') return 'bg-blue-50 text-blue-700 border-blue-200';
  if (status === 'pending') return 'bg-orange-50 text-orange-700 border-orange-200';
  if (status === 'cancelled') return 'bg-rose-50 text-rose-700 border-rose-200';
  return 'bg-slate-50 text-slate-600 border-slate-200';
}

function detectUiTheme(serviceName?: string): UiTheme {
  const name = (serviceName || '').toLowerCase();
  if (name.includes('เล็บ') || name.includes('nail')) {
    return { key: 'nail', accent: '#E05C86', accentSoft: '#FCEAF0', accentText: '#9E2B55', successTitle: 'จองคิวสำเร็จ' };
  }
  if (name.includes('คลินิก') || name.includes('แพทย์') || name.includes('clinic')) {
    return { key: 'clinic', accent: '#4FA56A', accentSoft: '#EAF7EF', accentText: '#2B6A3F', successTitle: 'จองคิวสำเร็จ' };
  }
  if (name.includes('บุฟเฟ่ต์') || name.includes('buffet')) {
    return { key: 'buffet', accent: '#4FA56A', accentSoft: '#EAF7EF', accentText: '#2B6A3F', successTitle: 'จองคิวสำเร็จ' };
  }
  if (name.includes('ห้องประชุม') || name.includes('meeting')) {
    return { key: 'meeting', accent: '#4FA56A', accentSoft: '#EAF7EF', accentText: '#2B6A3F', successTitle: 'จองคิวสำเร็จ' };
  }
  return { key: 'default', accent: '#4FA56A', accentSoft: '#EAF7EF', accentText: '#2B6A3F', successTitle: 'จองคิวสำเร็จ' };
}

function detectServiceKind(serviceName?: string): ServiceKind {
  const name = (serviceName || '').toLowerCase();
  if (name.includes('ตัดผม') || name.includes('สระ') || name.includes('barber')) return 'barber';
  if (name.includes('เล็บ') || name.includes('nail')) return 'nail';
  if (name.includes('คลินิก') || name.includes('แพทย์') || name.includes('ตรวจ')) return 'clinic';
  if (name.includes('บุฟเฟ่ต์') || name.includes('walk-in') || name.includes('โต๊ะ')) return 'buffet';
  if (name.includes('ห้องประชุม') || name.includes('meeting')) return 'meeting';
  return 'default';
}

function serviceMeta(s: Service): ServiceCardMeta {
  const kind = detectServiceKind(s.service_name);
  if (kind === 'barber') return { icon: '💈', subtitle: 'จองตามเวลาที่เลือกเอง' };
  if (kind === 'nail') return { icon: '💅', subtitle: 'เวลาบริการยืดหยุ่น' };
  if (kind === 'clinic') return { icon: '🩺', subtitle: 'จองตามเวลาที่นัดหมาย' };
  if (kind === 'buffet') return { icon: '🍽️', subtitle: s.service_name.toLowerCase().includes('walk') ? 'Walk-in' : 'รับจำนวนตามรอบ' };
  if (kind === 'meeting') return { icon: '🏢', subtitle: 'จองรายชั่วโมง/ครึ่งวัน' };
  return { icon: '📌', subtitle: 'เลือกบริการที่ต้องการ' };
}

export function LiffBookingClient({ shopKey, initialTab = 'booking' }: { shopKey: string; initialTab?: 'booking' | 'account' }) {
  const { push } = useToast();

  const [shop, setShop] = useState<ShopMeta | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [branchId, setBranchId] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [date, setDate] = useState(getTodayISOInBangkok());
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotHint, setSlotHint] = useState('');
  const [slotMeta, setSlotMeta] = useState<SlotMeta>({ reason: 'ok' });
  const [selectedTime, setSelectedTime] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [lineUserId, setLineUserId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [pictureUrl, setPictureUrl] = useState('');
  const [queueNo, setQueueNo] = useState('');
  const [loading, setLoading] = useState(false);
  const [memberReady, setMemberReady] = useState(false);
  const [memberStatus, setMemberStatus] = useState<'idle' | 'checking' | 'ready' | 'error'>('idle');
  const [memberError, setMemberError] = useState('');
  const [step, setStep] = useState<1 | 2>(1);
  const [tab, setTab] = useState<'booking' | 'account'>(initialTab);
  const [upcoming, setUpcoming] = useState<MyBooking[]>([]);
  const [history, setHistory] = useState<MyBooking[]>([]);
  const [accountLoading, setAccountLoading] = useState(false);
  const [liffOpenUrl, setLiffOpenUrl] = useState('');
  const [resolvedLiffId, setResolvedLiffId] = useState('');
  const [shopMetaError, setShopMetaError] = useState('');

  const canLoadSlots = branchId && serviceId && date;
  const canBook = memberReady && branchId && serviceId && date && selectedTime && customerName.trim().length >= 2 && customerPhone.trim().length >= 8;

  async function loadMe(opts?: { mode?: 'view' | 'update' }) {
    if (!lineUserId) return;
    setAccountLoading(true);
    const res = await fetch(`/api/public/shop/${shopKey}/me`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        line_user_id: lineUserId,
        display_name: displayName || undefined,
        picture_url: pictureUrl || undefined,
        full_name: customerName || undefined,
        phone: customerPhone || undefined,
        mode: opts?.mode ?? 'view',
      }),
    });
    const json = await res.json();
    setAccountLoading(false);
    if (!res.ok) return push(json.error ?? 'โหลดข้อมูลสมาชิกไม่สำเร็จ', 'error');
    if (json.data?.customer?.full_name) setCustomerName(json.data.customer.full_name);
    if (json.data?.customer?.phone) setCustomerPhone(json.data.customer.phone);
    setUpcoming(json.data?.upcoming ?? []);
    setHistory(json.data?.history ?? []);
  }

  useEffect(() => {
    void (async () => {
      setShopMetaError('');
      try {
        const res = await fetch(`/api/public/shop/${encodeURIComponent(shopKey)}/meta`, { cache: 'no-store' });
        const json = await res.json();
        if (!res.ok) {
          const msg = json.error ?? 'โหลดข้อมูลร้านไม่สำเร็จ';
          setShopMetaError(msg);
          return push(msg, 'error');
        }
        setShop(json.data.shop ?? null);
        setBranches(json.data.branches ?? []);
        setServices(json.data.services ?? []);
        if (json.data.branches?.[0]) setBranchId(json.data.branches[0].id);
        if (json.data.services?.[0]) setServiceId(json.data.services[0].id);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Network error';
        setShopMetaError(msg);
        push(`โหลดข้อมูลร้านไม่สำเร็จ: ${msg}`, 'error');
      }
    })();
  }, [shopKey, push]);

  useEffect(() => {
    if (!shop) return;

    void (async () => {
      setMemberStatus('checking');
      setMemberError('');
      try {
        const liffCandidates = getLiffCandidates(shop.liff_id, initialTab);
        setResolvedLiffId(liffCandidates[0] ?? '');
        if (!liffCandidates.length) {
          push('LIFF ID ไม่ถูกต้องหรือยังไม่ได้ตั้งค่าในร้าน/ENV', 'error');
          setMemberStatus('error');
          setMemberError('LIFF ID ไม่ถูกต้องหรือยังไม่ได้ตั้งค่าในร้าน/ENV');
          return;
        }

        const liff = await ensureLiffLoaded();
        if (!liff) {
          push('โหลด LIFF SDK ไม่สำเร็จ', 'error');
          setMemberStatus('error');
          setMemberError('โหลด LIFF SDK ไม่สำเร็จ');
          return;
        }

        let activeLiffId = '';
        let lastInitError: Error | null = null;
        for (const candidate of liffCandidates) {
          try {
            await Promise.race([
              liff.init({ liffId: candidate }),
              new Promise((_, reject) => setTimeout(() => reject(new Error('LIFF init timeout')), 12000)),
            ]);
            activeLiffId = candidate;
            setResolvedLiffId(candidate);
            lastInitError = null;
            break;
          } catch (e) {
            lastInitError = e instanceof Error ? e : new Error('LIFF init failed');
          }
        }
        if (!activeLiffId) throw (lastInitError ?? new Error('invalid liff id'));

        if (!liff.isLoggedIn()) {
          const openUrl = buildLiffOpenUrl(activeLiffId, shopKey, initialTab);
          setLiffOpenUrl(openUrl);
          setMemberStatus('error');
          setMemberError('กรุณาเปิดหน้านี้ผ่าน LINE LIFF');
          if (typeof window !== 'undefined' && liff.isInClient?.()) {
            liff.login();
          }
          return;
        }

        const profile = await liff.getProfile();
        setLineUserId(profile.userId);
        setDisplayName(profile.displayName);
        setPictureUrl(profile.pictureUrl ?? '');
        if (!customerName) setCustomerName(profile.displayName);

        const memberRes = await fetch(`/api/public/shop/${shopKey}/member-context`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            line_user_id: profile.userId,
            display_name: profile.displayName,
            picture_url: profile.pictureUrl,
          }),
        });

        const memberJson = await memberRes.json();
        if (!memberRes.ok) {
          push(memberJson.error ?? 'ตรวจสอบสมาชิกไม่สำเร็จ', 'error');
          setMemberStatus('error');
          setMemberError(memberJson.error ?? 'ตรวจสอบสมาชิกไม่สำเร็จ');
          return;
        }

        if (memberJson.data?.customer?.full_name) setCustomerName(memberJson.data.customer.full_name);
        if (memberJson.data?.customer?.phone) setCustomerPhone(memberJson.data.customer.phone);
        if (memberJson.data?.was_registered) push('สมัครสมาชิกกับร้านสำเร็จแล้ว กรุณายืนยันข้อมูลก่อนจองคิว', 'success');
        setMemberReady(true);
        setMemberStatus('ready');
        void loadMe();
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'LIFF init failed';
        push(msg, 'error');
        setMemberStatus('error');
        setMemberError(msg);
      }
    })();
  }, [shop, customerName, push, shopKey, initialTab]);

  useEffect(() => {
    if (!lineUserId || memberStatus !== 'ready') return;
    void loadMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineUserId, memberStatus]);

  function retryMemberCheck() {
    setMemberReady(false);
    setMemberStatus('idle');
    setMemberError('');
    // trigger by cloning object reference
    setShop((prev) => (prev ? { ...prev } : prev));
  }

  async function loadSlots() {
    if (!canLoadSlots) return;
    setLoading(true);
    setSlotHint('');
    setSlotMeta({ reason: 'ok' });
    setSelectedTime('');
    const url = `/api/public/shop/${shopKey}/slots?branch_id=${branchId}&service_id=${serviceId}&date=${date}`;
    try {
      const res = await fetch(url);
      const json = await res.json();
      setLoading(false);
      if (!res.ok) {
        const msg = json.error ?? 'โหลดคิวว่างไม่สำเร็จ';
        setSlots([]);
        setSlotHint(msg);
        return push(msg, 'error');
      }
      const nextSlots = (json.data ?? []) as Slot[];
      setSlots(nextSlots);
      const nextMeta = (json.meta ?? { reason: 'ok' }) as SlotMeta;
      setSlotMeta(nextMeta);
      if (nextSlots.length === 0) {
        setSlotHint(nextMeta.hint || 'ไม่พบเวลาว่างในวันที่เลือก');
      }
    } catch {
      setLoading(false);
      setSlots([]);
      setSlotHint('โหลดคิวว่างไม่สำเร็จ กรุณาลองใหม่');
      setSlotMeta({ reason: 'full' });
    }
  }

  useEffect(() => {
    setSlots([]);
    setSelectedTime('');
    setSlotHint('');
    setSlotMeta({ reason: 'ok' });
  }, [branchId, serviceId, date]);

  useEffect(() => {
    if (step !== 2 || !canLoadSlots) return;
    void loadSlots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, branchId, serviceId, date]);

  async function bookNow() {
    if (!canBook) return;
    setLoading(true);
    const res = await fetch(`/api/public/shop/${shopKey}/book`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        branch_id: branchId,
        service_id: serviceId,
        booking_date: date,
        start_time: `${selectedTime}:00`,
        customer_name: customerName,
        customer_phone: customerPhone,
        line_user_id: lineUserId || undefined,
      }),
    });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) return push(json.error ?? 'จองคิวไม่สำเร็จ', 'error');
    setQueueNo(json.data.queue_number);
    if (!json.data?.line_push_sent) {
      const dateLabel = formatDateDMY(json.data?.booking_date ?? date);
  /*     const text = `จองคิวสำเร็จค่ะ\nเลขคิว: ${json.data?.queue_number ?? '-'}\nสาขา: ${json.data?.branch_name ?? selectedBranch?.branch_name ?? '-'}\nบริการ: ${json.data?.service_name ?? selectedService?.service_name ?? '-'}\nวันที่: ${dateLabel}\nเวลา: ${json.data?.booking_time ?? selectedTime}\n\nกรุณามาก่อนเวลาประมาณ 10 นาทีค่ะ`;
      try {
        const liff = await ensureLiffLoaded();
        if (liff?.sendMessages) await liff.sendMessages([{ type: 'text', text }]);
      } catch { 
      } */
    }

    push('จองคิวสำเร็จ');
    void loadMe();
    try {
      const liff = await ensureLiffLoaded();
      if (liff?.isInClient?.() && liff?.closeWindow) {
        setTimeout(() => liff.closeWindow?.(), 600);
      }
    } catch {
      // no-op
    }
  }

  const selectedBranch = useMemo(() => branches.find((b) => b.id === branchId), [branches, branchId]);
  const selectedService = useMemo(() => services.find((s) => s.id === serviceId), [services, serviceId]);
  const uiTheme = useMemo(() => detectUiTheme(selectedService?.service_name), [selectedService?.service_name]);

  async function cancelBooking(bookingId: string) {
    if (!lineUserId) return;
    const ok = window.confirm('ยืนยันยกเลิกคิวนี้?');
    if (!ok) return;
    const res = await fetch(`/api/public/shop/${shopKey}/cancel-booking`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ line_user_id: lineUserId, booking_id: bookingId }),
    });
    const json = await res.json();
    if (!res.ok) return push(json.error ?? 'ยกเลิกคิวไม่สำเร็จ', 'error');
    push('ยกเลิกคิวแล้ว');
    void loadMe();
  }

  async function closeLiffOrBack() {
    try {
      const liff = await ensureLiffLoaded();
      if (liff?.isInClient?.() && liff?.closeWindow) return liff.closeWindow();
    } catch {
      // no-op
    }
    if (typeof window !== 'undefined') window.history.back();
  }

  if (queueNo) {
    return (
      <main className="min-h-screen p-4" style={{ background: '#f4f6f8' }}>
        <section className="mx-auto max-w-md overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-sm">
          <div className="px-4 py-3 text-center text-white" style={{ background: uiTheme.accent }}>
            <h1 className="text-lg font-bold">{uiTheme.successTitle}</h1>
          </div>
          <div className="space-y-2 p-5 text-sm">
            <p className="text-2xl font-extrabold tracking-tight text-slate-900">เลขคิว {queueNo}</p>
            <p>บริการ: <b>{selectedService?.service_name ?? '-'}</b></p>
            <p>วันที่: <b>{formatDateDMY(date)}</b></p>
            <p>เวลา: <b>{selectedTime}</b></p>
            <p>สาขา: <b>{selectedBranch?.branch_name ?? '-'}</b></p>
            <p className="pt-2 text-xs text-slate-500">กรุณามาก่อนเวลาประมาณ 10 นาที</p>
            <div className="space-y-2 pt-2">
              <button className="btn-outline w-full" onClick={() => setTab('account')}>ดูคิวของฉัน</button>
              <button className="btn-outline w-full" onClick={() => setQueueNo('')}>จองคิวอีกครั้ง</button>
              <button className="btn-primary w-full" style={{ background: uiTheme.accent }} onClick={() => setTab('account')}>เปิด LIFF อีกครั้ง</button>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-4" style={{ background: '#f4f6f8' }}>
      <section className="mx-auto max-w-md overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-sm">
        <div className="px-4 py-3 text-white" style={{ background: uiTheme.accent }}>
          <p className="text-xs opacity-90">{shop?.name ?? 'ร้านค้า'}</p>
          <h1 className="text-base font-semibold">{tab === 'booking' ? 'เลือกบริการและเวลาจองคิว' : 'ข้อมูลสมาชิก'}</h1>
        </div>
        <div className="space-y-4 p-4">
     {/*    <div className="space-y-1">
          <p className="text-xs text-slate-500">รองรับร้านตัดผม • ร้านทำเล็บ • คลินิก • ร้านบุฟเฟ่ต์ • ห้องประชุม</p>
        </div> */}
        {shopMetaError ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            โหลดข้อมูลร้านไม่สำเร็จ: {shopMetaError}
          </div>
        ) : null}

        {initialTab === 'booking' ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
            เมนูนี้สำหรับจองคิว
          </div>
        ) : (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
            ข้อมูลสมาชิก
          </div>
        )}

        {tab === 'booking' ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              <button className={step === 1 ? 'btn-primary' : 'btn-outline'} style={step === 1 ? { background: uiTheme.accent } : undefined} disabled>1) เลือกบริการ</button>
              <button className={step === 2 ? 'btn-primary' : 'btn-outline'} style={step === 2 ? { background: uiTheme.accent } : undefined} disabled>2) เลือกวันเวลา</button>
            </div>
            {step === 1 ? (
          <div className="space-y-3">
            {memberStatus === 'checking' ? <p className="text-xs text-slate-500">กำลังตรวจสอบสมาชิกของร้าน...</p> : null}
            {memberStatus === 'error' ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                <p>{memberError || 'ตรวจสอบสมาชิกไม่สำเร็จ'}</p>
                {resolvedLiffId ? (
                  <p className="mt-2 font-mono text-[11px] text-rose-800">
                    LIFF ID: {resolvedLiffId}
                  </p>
                ) : null}
                {liffOpenUrl ? (
                  <a className="btn-outline mt-2 inline-flex" href={liffOpenUrl}>
                    เปิดผ่าน LINE
                  </a>
                ) : null}
                <button className="btn-outline mt-2" onClick={retryMemberCheck}>ลองใหม่</button>
              </div>
            ) : null}
            <input className="input" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="ชื่อผู้จอง" />
            <input className="input" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="เบอร์โทร" />
            <p className="text-xs text-slate-500">กรุณาเลือกบริการที่ต้องการ</p>
            <div className="space-y-2">
              {services.map((s) => {
                const meta = serviceMeta(s);
                return (
                <button
                  key={`preset-${s.id}`}
                  className={`w-full rounded-2xl border px-3 py-2.5 text-left text-sm transition ${
                    serviceId === s.id ? 'border-transparent text-white shadow-sm' : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300'
                  }`}
                  style={serviceId === s.id ? { background: uiTheme.accent } : undefined}
                  onClick={() => setServiceId(s.id)}
                >
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 text-xl">{meta.icon}</span>
                    <div>
                      <div className="font-semibold">{s.service_name}</div>
                      <div className={`text-xs ${serviceId === s.id ? 'text-white/90' : 'text-slate-500'}`}>
                        {s.duration_minutes} นาที • {meta.subtitle}
                      </div>
                    </div>
                  </div>
                </button>
                );
              })}
            </div>
            <button
              className="btn-primary w-full"
              style={{ background: uiTheme.accent }}
              disabled={memberStatus !== 'ready' || customerName.trim().length < 2 || customerPhone.trim().length < 8}
              onClick={() => setStep(2)}
            >
              ถัดไป: เลือกคิว
            </button>
            <button className="btn-outline w-full !bg-slate-100 !text-slate-700 !border-slate-200" onClick={() => void closeLiffOrBack()}>
              ยกเลิก
            </button>
          </div>
            ) : (
          <div className="space-y-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              <p className="font-semibold text-slate-800">{selectedService?.service_name ?? '-'}</p>
              <p>สาขา {selectedBranch?.branch_name ?? '-'} • ระยะเวลา {selectedService?.duration_minutes ?? '-'} นาที</p>
            </div>
            <select className="input" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.branch_name}</option>)}
            </select>
            <select className="input" value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
              {services.map((s) => <option key={s.id} value={s.id}>{s.service_name} ({s.duration_minutes} นาที)</option>)}
            </select>
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <button className="btn-primary w-full" style={{ background: uiTheme.accent }} onClick={() => void loadSlots()} disabled={!canLoadSlots || loading}>{loading ? 'กำลังโหลด...' : 'ดูเวลาว่าง'}</button>

            {slotMeta.reason !== 'ok' ? (
              <div
                className={`rounded-xl border px-3 py-2 text-xs ${
                  slotMeta.reason === 'holiday'
                    ? 'border-violet-200 bg-violet-50 text-violet-700'
                    : slotMeta.reason === 'closed'
                      ? 'border-slate-300 bg-slate-50 text-slate-700'
                      : 'border-amber-200 bg-amber-50 text-amber-700'
                }`}
              >
                {slotMeta.reason === 'holiday' ? 'วันหยุด' : slotMeta.reason === 'closed' ? 'ปิดทำการ' : 'คิวเต็ม'}
              </div>
            ) : null}
            {slotHint ? <p className="text-xs text-amber-700">{slotHint}</p> : null}

            <div className="grid grid-cols-3 gap-2">
              {slots.map((s) => {
                const t = s.slot_time.slice(0, 5);
                const active = selectedTime === t;
                return <button key={s.slot_time} className={active ? 'btn-primary !rounded-xl !py-2.5' : 'btn-outline !rounded-xl !py-2.5'} style={active ? { background: uiTheme.accent } : undefined} onClick={() => setSelectedTime(t)}>{t}</button>;
              })}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button className="btn-outline" onClick={() => setStep(1)}>ย้อนกลับ</button>
              <button className="btn-primary" style={{ background: uiTheme.accent }} onClick={() => void bookNow()} disabled={!canBook || loading}>{loading ? 'กำลังบันทึก...' : 'ยืนยันจองคิว'}</button>
            </div>
          </div>
            )}
          </>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-3">
              <div className="flex items-center gap-3">
                {pictureUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={pictureUrl} alt={displayName || customerName} className="h-12 w-12 rounded-full object-cover" />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-200 font-semibold text-slate-600">
                    {(displayName || customerName || 'U').slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">{displayName || customerName || 'LINE User'}</p>
                  <p className="truncate text-xs text-slate-500">{lineUserId || '-'}</p>
                </div>
              </div>
              <div className="mt-3 grid gap-2">
                <input className="input" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="ชื่อผู้จอง" />
                <input className="input" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="เบอร์โทร" />
                <button className="btn-primary" disabled={accountLoading} onClick={() => void loadMe({ mode: 'update' })}>
                  {accountLoading ? 'กำลังบันทึก...' : 'บันทึกข้อมูลส่วนตัว'}
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-3 space-y-2">
              <h3 className="text-sm font-semibold text-slate-800">คิวที่จองอยู่</h3>
              {upcoming.length === 0 ? <p className="text-xs text-slate-500">ไม่มีคิวที่กำลังใช้งาน</p> : upcoming.map((b) => (
                <div key={b.id} className="rounded-2xl border border-slate-200 bg-white p-3.5 text-sm shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold tracking-tight text-slate-900">{b.queue_number}</p>
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${bookingStatusStyle(String(b.status))}`}>
                      {String(b.status)}
                    </span>
                  </div>
                  <div className="mt-2 space-y-1.5">
                    <p className="text-slate-700">
                      <span className="text-slate-500">เวลา</span>{' '}
                      {formatDateDMY(b.booking_date)} • {String(b.start_time).slice(0, 5)}
                    </p>
                    <p className="text-slate-700">
                      <span className="text-slate-500">สาขา</span>{' '}
                      {b.branches?.branch_name ?? '-'}
                    </p>
                    <p className="text-slate-700">
                      <span className="text-slate-500">บริการ</span>{' '}
                      {b.services?.service_name ?? '-'}
                    </p>
                  </div>
                  {(b.status === 'pending' || b.status === 'confirmed' || b.status === 'waiting') ? (
                    <button className="btn-outline mt-3 w-full" onClick={() => void cancelBooking(b.id)}>ยกเลิกคิว</button>
                  ) : null}
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-3 space-y-2">
              <h3 className="text-sm font-semibold text-slate-800">ประวัติการจอง</h3>
              {history.length === 0 ? <p className="text-xs text-slate-500">ยังไม่มีประวัติ</p> : history.map((b) => (
                <div key={b.id} className="rounded-2xl border border-slate-200 bg-white p-3.5 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-slate-900">{b.queue_number}</p>
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${bookingStatusStyle(String(b.status))}`}>
                      {String(b.status)}
                    </span>
                  </div>
                  <p className="mt-2 text-slate-700">{formatDateDMY(b.booking_date)} • {String(b.start_time).slice(0, 5)}</p>
                  <p className="text-slate-600">{b.branches?.branch_name ?? '-'} • {b.services?.service_name ?? '-'}</p>
                </div>
              ))}
            </div>
          </div>
        )}
        </div>
      </section>
    </main>
  );
}
