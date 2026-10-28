'use client';

import { FormEvent, useCallback, useRef, useState } from 'react';
import Script from 'next/script';
import { useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/components/ui/toast';
import { getStoredUtm, track } from '@/lib/analytics/track';
import { formatThaiPhone, isCompleteThaiPhone, normalizeThaiPhoneDigits } from '@/lib/utils/thai-phone';

/** Values must match service_templates.business_category so seeding finds templates. */
const BUSINESS_CATEGORIES = [
  { value: 'ร้านตัดผม', label: 'ร้านตัดผม / ร้านเสริมสวย' },
  { value: 'ร้านทำเล็บ', label: 'ร้านทำเล็บ' },
  { value: 'spa', label: 'สปา / ร้านนวด' },
  { value: 'คลินิก', label: 'คลินิก / สถานพยาบาล' },
  { value: 'beauty_clinic', label: 'คลินิกความงาม / ทันตกรรม' },
  { value: 'pet', label: 'สัตว์เลี้ยง (อาบน้ำตัดขน / คลินิกสัตว์)' },
  { value: 'ร้านอาหาร', label: 'ร้านอาหาร' },
  { value: 'buffet', label: 'บุฟเฟ่ต์' },
  { value: 'fitness', label: 'ฟิตเนส / คลาสออกกำลังกาย' },
  { value: 'sports_court', label: 'สนามกีฬา (แบด / เทนนิส / ฟุตบอล)' },
  { value: 'outdoor', label: 'สนามบีบีกัน / กิจกรรม outdoor' },
  { value: 'tutoring', label: 'คลาสเรียน / ติวเตอร์' },
  { value: 'photo_studio', label: 'สตูดิโอถ่ายภาพ' },
  { value: 'event', label: 'งานอีเวนต์ / สัมมนา / จองบูธ' },
  { value: 'meeting_room', label: 'ห้องประชุม / พื้นที่เช่า' },
  { value: 'ร้านซ่อมรถ', label: 'ศูนย์บริการรถยนต์' },
  { value: 'car_care', label: 'คาร์แคร์ / ล้างรถ' },
  { value: 'ร้านซ่อมมือถือ', label: 'ร้านซ่อมมือถือ / ไอที' },
  { value: 'ทีมช่างติดตั้ง', label: 'ทีมช่าง / งานติดตั้งนอกสถานที่' },
  { value: 'งานราชการ', label: 'หน่วยงานราชการ' },
  { value: 'Consult', label: 'ที่ปรึกษา / นัดหมายส่วนตัว' },
];

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (widgetId?: string) => void;
};

/** Without a site key (local dev) the widget is skipped and the server skips the check too. */
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';

/**
 * Shop signup form.
 *
 * @param props.formToken - Server-signed issue time (bot "filled too fast" check).
 */
export function RegisterForm({ formToken }: { formToken: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { push } = useToast();
  const [loading, setLoading] = useState(false);
  const [phone, setPhone] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const captchaBox = useRef<HTMLDivElement>(null);
  const captchaWidget = useRef<string | null>(null);
  const selectedPlan = searchParams.get('plan') ?? '';

  const renderCaptcha = useCallback(() => {
    const api = (window as unknown as { turnstile?: TurnstileApi }).turnstile;
    if (!api || !captchaBox.current || captchaWidget.current) return;
    captchaWidget.current = api.render(captchaBox.current, {
      sitekey: TURNSTILE_SITE_KEY,
      action: 'register',
      appearance: 'interaction-only',
      callback: (token: string) => setCaptchaToken(token),
      'expired-callback': () => setCaptchaToken(''),
      'error-callback': () => setCaptchaToken(''),
    });
  }, []);

  /** Turnstile tokens are single-use: get a new one after every server answer that was not a success. */
  function resetCaptcha() {
    setCaptchaToken('');
    const api = (window as unknown as { turnstile?: TurnstileApi }).turnstile;
    if (api && captchaWidget.current) api.reset(captchaWidget.current);
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isCompleteThaiPhone(phone)) {
      push('กรุณากรอกเบอร์โทร 10 หลัก', 'error');
      return;
    }
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const payload = {
      ...Object.fromEntries(formData.entries()),
      phone: normalizeThaiPhoneDigits(phone),
      utm: getStoredUtm(),
      showcase_consent: formData.get('showcase_consent') === 'on',
      turnstile_token: captchaToken,
    };
    track('signup_started', { plan: selectedPlan || 'starter' });

    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const json = await res.json();
    setLoading(false);

    if (!res.ok) {
      resetCaptcha();
      push(json.error ?? 'สมัครใช้งานไม่สำเร็จ', 'error');
      return;
    }

    track('signup_completed', { plan: selectedPlan || 'starter', seeded: Boolean(json.data?.seeded) });
    push(json.message ?? 'สมัครสำเร็จ กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ');
    const email = String(formData.get('email') ?? '');
    sessionStorage.setItem('verify_email', email);
    router.push('/verify-email');
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <input className="input" name="company_name" placeholder="ชื่อบริษัท" required />
      <input className="input" name="shop_name" placeholder="ชื่อร้าน" required />
      <input className="input" name="owner_name" placeholder="ชื่อเจ้าของ" required />
      <input
        className="input"
        name="phone"
        type="tel"
        inputMode="numeric"
        autoComplete="tel"
        maxLength={12}
        placeholder="เบอร์โทร เช่น 085-608-3298"
        value={formatThaiPhone(phone)}
        onChange={(e) => setPhone(normalizeThaiPhoneDigits(e.target.value))}
        required
      />
      <input className="input" type="email" name="email" placeholder="Email" required />
      <input className="input" type="password" name="password" placeholder="Password" required />
      <select className="input" name="business_category" defaultValue="">
        <option value="">ประเภทธุรกิจ (ไม่บังคับ — ช่วยตั้งค่าบริการเริ่มต้นให้)</option>
        {BUSINESS_CATEGORIES.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>
      <label className="flex items-start gap-2 rounded-lg border border-dashed border-emerald-300 bg-emerald-50/60 px-3 py-2 text-xs text-slate-600">
        <input type="checkbox" name="showcase_consent" className="mt-0.5" />
        <span>
          ยินยอมให้แสดงชื่อร้าน โลโก้ และคำรีวิวของร้านบนเว็บไซต์ เพื่อแนะนำร้านให้ลูกค้าใหม่ เลือกได้ว่าจะแสดงอะไร และถอนความยินยอมได้ทุกเมื่อในหน้าตั้งค่า (ไม่บังคับ)
        </span>
      </label>
      <input type="hidden" name="plan_name" value={selectedPlan} />
      <input type="hidden" name="form_token" value={formToken} />
      {/* Honeypot: off-screen, skipped by keyboard, screen readers and autofill. A filled value = bot. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          เว็บไซต์บริษัท
          <input type="text" name="company_website" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>
      {TURNSTILE_SITE_KEY ? (
        <>
          <Script
            src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
            strategy="afterInteractive"
            onReady={renderCaptcha}
          />
          <div ref={captchaBox} />
        </>
      ) : null}
      <button disabled={loading || (Boolean(TURNSTILE_SITE_KEY) && !captchaToken)} className="btn-primary w-full" type="submit">
        {loading ? 'กำลังสมัคร...' : TURNSTILE_SITE_KEY && !captchaToken ? 'กำลังตรวจสอบความปลอดภัย...' : 'สมัครใช้งาน'}
      </button>
    </form>
  );
}
