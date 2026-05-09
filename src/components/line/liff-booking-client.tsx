'use client';

import { useEffect, useMemo, useState } from 'react';
import { useToast } from '@/components/ui/toast';

type Branch = { id: string; branch_name: string };
type Service = { id: string; service_name: string; duration_minutes: number };
type Slot = { slot_time: string; remaining_capacity: number };
type ShopMeta = { id: string; name: string; shop_key: string; liff_id?: string | null };

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
  const m = raw.match(/liff\.line\.me\/(.+)$/);
  return m?.[1] ?? raw;
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

export function LiffBookingClient({ shopKey }: { shopKey: string }) {
  const { push } = useToast();

  const [shop, setShop] = useState<ShopMeta | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [branchId, setBranchId] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedTime, setSelectedTime] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [lineUserId, setLineUserId] = useState('');
  const [queueNo, setQueueNo] = useState('');
  const [loading, setLoading] = useState(false);
  const [memberReady, setMemberReady] = useState(false);
  const [memberStatus, setMemberStatus] = useState<'idle' | 'checking' | 'ready' | 'error'>('idle');
  const [memberError, setMemberError] = useState('');
  const [step, setStep] = useState<1 | 2>(1);

  const canLoadSlots = branchId && serviceId && date;
  const canBook = memberReady && branchId && serviceId && date && selectedTime && customerName.trim().length >= 2 && customerPhone.trim().length >= 8;

  useEffect(() => {
    void (async () => {
      const res = await fetch(`/api/public/shop/${shopKey}/meta`);
      const json = await res.json();
      if (!res.ok) return push(json.error ?? 'โหลดข้อมูลร้านไม่สำเร็จ', 'error');
      setShop(json.data.shop ?? null);
      setBranches(json.data.branches ?? []);
      setServices(json.data.services ?? []);
      if (json.data.branches?.[0]) setBranchId(json.data.branches[0].id);
      if (json.data.services?.[0]) setServiceId(json.data.services[0].id);
    })();
  }, [shopKey, push]);

  useEffect(() => {
    if (!shop) return;

    void (async () => {
      setMemberStatus('checking');
      setMemberError('');
      try {
        const liffId = normalizeLiffId(shop.liff_id ?? process.env.NEXT_PUBLIC_LIFF_ID);
        if (!liffId) {
          push('ยังไม่ได้ตั้งค่า LIFF ID ของร้าน', 'error');
          setMemberStatus('error');
          setMemberError('ยังไม่ได้ตั้งค่า LIFF ID ของร้าน');
          return;
        }

        const liff = await ensureLiffLoaded();
        if (!liff) {
          push('โหลด LIFF SDK ไม่สำเร็จ', 'error');
          setMemberStatus('error');
          setMemberError('โหลด LIFF SDK ไม่สำเร็จ');
          return;
        }

        await Promise.race([
          liff.init({ liffId }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('LIFF init timeout')), 12000)),
        ]);
        if (!liff.isLoggedIn()) {
          setMemberStatus('error');
          setMemberError('ไม่ได้เปิดผ่าน LINE App หรือยังไม่ได้ login LIFF');
          liff.login();
          return;
        }

        const profile = await liff.getProfile();
        setLineUserId(profile.userId);
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
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'LIFF init failed';
        push(msg, 'error');
        setMemberStatus('error');
        setMemberError(msg);
      }
    })();
  }, [shop, customerName, push, shopKey]);

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
    const url = `/api/public/shop/${shopKey}/slots?branch_id=${branchId}&service_id=${serviceId}&date=${date}`;
    const res = await fetch(url);
    const json = await res.json();
    setLoading(false);
    if (!res.ok) return push(json.error ?? 'โหลดคิวว่างไม่สำเร็จ', 'error');
    setSlots(json.data ?? []);
  }

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
      const d = json.data?.booking_date ? new Date(`${json.data.booking_date}T00:00:00+07:00`) : null;
      const dateLabel = d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }) : (json.data?.booking_date ?? date);
  /*     const text = `จองคิวสำเร็จค่ะ\nเลขคิว: ${json.data?.queue_number ?? '-'}\nสาขา: ${json.data?.branch_name ?? selectedBranch?.branch_name ?? '-'}\nบริการ: ${json.data?.service_name ?? selectedService?.service_name ?? '-'}\nวันที่: ${dateLabel}\nเวลา: ${json.data?.booking_time ?? selectedTime}\n\nกรุณามาก่อนเวลาประมาณ 10 นาทีค่ะ`;
      try {
        const liff = await ensureLiffLoaded();
        if (liff?.sendMessages) await liff.sendMessages([{ type: 'text', text }]);
      } catch { 
      } */
    }

    push('จองคิวสำเร็จ');
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

  if (queueNo) {
    return (
      <main className="min-h-screen p-4">
        <section className="card mx-auto max-w-md p-6 space-y-2">
          <h1 className="text-xl font-bold">จองคิวสำเร็จ</h1>
          <p>เลขคิว: <b>{queueNo}</b></p>
          <p>สาขา: {selectedBranch?.branch_name}</p>
          <p>บริการ: {selectedService?.service_name}</p>
          <p>วันที่: {date}</p>
          <p>เวลา: {selectedTime}</p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-4">
      <section className="card mx-auto max-w-md p-4 space-y-4">
        <div className="space-y-1">
          <h1 className="text-xl font-bold">จองคิวผ่าน LINE</h1>
          <p className="text-xs text-slate-500">{shop?.name ?? 'ร้านค้า'} • Step {step}/2</p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button className={step === 1 ? 'btn-primary' : 'btn-outline'} disabled>1) ข้อมูลสมาชิก</button>
          <button className={step === 2 ? 'btn-primary' : 'btn-outline'} disabled>2) เลือกคิว</button>
        </div>

        {step === 1 ? (
          <div className="space-y-3">
            {memberStatus === 'checking' ? <p className="text-xs text-slate-500">กำลังตรวจสอบสมาชิกของร้าน...</p> : null}
            {memberStatus === 'error' ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                <p>{memberError || 'ตรวจสอบสมาชิกไม่สำเร็จ'}</p>
                <button className="btn-outline mt-2" onClick={retryMemberCheck}>ลองใหม่</button>
              </div>
            ) : null}
            <input className="input" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="ชื่อผู้จอง" />
            <input className="input" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="เบอร์โทร" />
            <button
              className="btn-primary w-full"
              disabled={memberStatus !== 'ready' || customerName.trim().length < 2 || customerPhone.trim().length < 8}
              onClick={() => setStep(2)}
            >
              ถัดไป: เลือกคิว
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <select className="input" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.branch_name}</option>)}
            </select>
            <select className="input" value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
              {services.map((s) => <option key={s.id} value={s.id}>{s.service_name} ({s.duration_minutes} นาที)</option>)}
            </select>
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <button className="btn-primary w-full" onClick={() => void loadSlots()} disabled={!canLoadSlots || loading}>{loading ? 'กำลังโหลด...' : 'ดูเวลาว่าง'}</button>

            <div className="grid grid-cols-2 gap-2">
              {slots.map((s) => {
                const t = s.slot_time.slice(0, 5);
                const active = selectedTime === t;
                return <button key={s.slot_time} className={active ? 'btn-primary' : 'btn-outline'} onClick={() => setSelectedTime(t)}>{t}</button>;
              })}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button className="btn-outline" onClick={() => setStep(1)}>ย้อนกลับ</button>
              <button className="btn-primary" onClick={() => void bookNow()} disabled={!canBook || loading}>{loading ? 'กำลังบันทึก...' : 'ยืนยันจองคิว'}</button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
