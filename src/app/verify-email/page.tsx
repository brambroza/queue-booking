'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { identifyUser, track } from '@/lib/analytics/track';

/**
 * Supabase's "Email OTP Length" is a project setting (6–10 digits; this project
 * uses 8). Accept the whole range so a dashboard change never locks customers
 * out of the form again.
 */
const OTP_MIN = 6;
const OTP_MAX = 10;
const isOtpComplete = (value: string) => value.length >= OTP_MIN && value.length <= OTP_MAX;

export default function VerifyEmailPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [resendMessage, setResendMessage] = useState('');

  useEffect(() => {
    const stored = sessionStorage.getItem('verify_email');
    if (!stored) {
      router.replace('/login');
      return;
    }
    setEmail(stored);
  }, [router]);

  async function verify() {
    if (!isOtpComplete(otp)) return;
    setLoading(true);
    setError('');
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.verifyOtp({ email, token: otp, type: 'email' });
      if (error) {
        setError(error.message);
        return;
      }
      if (data.user) identifyUser(data.user.id);
      track('email_verified');
      sessionStorage.removeItem('verify_email');
      router.push('/portal/dashboard');
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    setResending(true);
    setResendMessage('');
    setError('');
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resend({ type: 'signup', email });
      if (error) {
        setError(error.message);
        return;
      }
      setResendMessage('ส่งรหัสใหม่แล้ว กรุณาตรวจสอบอีเมล');
    } finally {
      setResending(false);
    }
  }

  if (!email) return null;

  return (
    <main className="min-h-screen grid place-items-center p-4">
      <section className="card w-full max-w-md p-6">
        <h1 className="text-2xl font-bold">ยืนยันอีเมล</h1>
        <p className="mt-1 text-sm text-slate-600">
          กรอกรหัสยืนยันที่ส่งไปยัง{' '}
          <span className="font-medium text-slate-800">{email}</span>
        </p>
        {/* The confirmation email also carries a link; a customer who taps it (or
            whose email shows only the link) is already confirmed and can just log in. */}
        <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600">
          ไม่เห็นอีเมล? ลองดูในกล่องสแปม/จดหมายขยะ · ถ้าในอีเมลมีปุ่ม “ยืนยันอีเมล” กดปุ่มนั้นแทนได้ แล้ว{' '}
          <Link href="/login" className="font-medium text-brand-700 hover:underline">เข้าสู่ระบบ</Link>{' '}
          ด้วยอีเมลและรหัสผ่านที่ตั้งไว้
        </p>

        <div className="mt-4 space-y-3">
          <input
            className="input text-center tracking-[0.4em] text-xl font-mono"
            type="text"
            inputMode="numeric"
            maxLength={OTP_MAX}
            placeholder="รหัสจากอีเมล"
            value={otp}
            onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
            autoComplete="one-time-code"
            autoFocus
          />

          {error && <p className="text-sm text-red-600">{error}</p>}
          {resendMessage && <p className="text-sm text-green-600">{resendMessage}</p>}

          <button
            disabled={loading || !isOtpComplete(otp)}
            onClick={verify}
            className="btn-primary w-full"
          >
            {loading ? 'กำลังยืนยัน...' : 'ยืนยันอีเมล'}
          </button>

          <button
            type="button"
            disabled={resending}
            onClick={resend}
            className="w-full text-sm text-brand-700 hover:underline disabled:opacity-50"
          >
            {resending ? 'กำลังส่ง...' : 'ส่งรหัสใหม่'}
          </button>
        </div>

        <p className="mt-4 text-sm">
          <Link href="/login" className="text-brand-700 hover:underline">
            กลับหน้าเข้าสู่ระบบ
          </Link>
        </p>
      </section>
    </main>
  );
}
