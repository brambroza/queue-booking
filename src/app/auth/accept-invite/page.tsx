'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { createClient } from '@/lib/supabase/client';
import { parseInviteLink } from '@/lib/auth/invite-link';

const PASSWORD_MIN = 8;

type Step = 'checking' | 'password' | 'invalid';

/** Landing page of an emailed staff invite: opens the session, then sets a password. */
export default function AcceptInvitePage() {
  const router = useRouter();
  const started = useRef(false);
  const [step, setStep] = useState<Step>('checking');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const link = parseInviteLink(window.location.hash);
    // Clear before the client exists: it would otherwise find the tokens itself and
    // reject them as "Not a valid PKCE flow url". Also keeps them out of history.
    window.history.replaceState(null, '', window.location.pathname);

    if (link.kind !== 'session') {
      setStep('invalid');
      return;
    }

    void (async () => {
      const { error: sessionError } = await createClient().auth.setSession({
        access_token: link.accessToken,
        refresh_token: link.refreshToken,
      });
      setStep(sessionError ? 'invalid' : 'password');
    })();
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('รหัสผ่านทั้งสองช่องไม่ตรงกัน');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const { error: updateError } = await createClient().auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message);
        return;
      }
      router.push('/portal/dashboard');
      router.refresh();
    } catch {
      setError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen grid place-items-center p-4">
      <section className="card w-full max-w-md p-6">
        <h1 className="text-2xl font-bold">ตั้งรหัสผ่าน</h1>

        {step === 'checking' && <p className="mt-2 text-sm text-slate-600">กำลังตรวจสอบลิงก์...</p>}

        {step === 'invalid' && (
          <div className="mt-2 space-y-3">
            <p className="text-sm text-slate-600">
              ลิงก์นี้หมดอายุหรือถูกใช้ไปแล้ว ขอให้เจ้าของร้านส่งลิงก์ใหม่ หรือขอรหัสทางอีเมลด้วยตัวเอง
            </p>
            <Link href="/forgot-password" className="btn-primary w-full block text-center">
              ขอรหัสทางอีเมล
            </Link>
          </div>
        )}

        {step === 'password' && (
          <form onSubmit={onSubmit} className="mt-4 space-y-3">
            <p className="text-sm text-slate-600">ตั้งรหัสผ่านสำหรับเข้าสู่ระบบครั้งต่อไป</p>
            <div className="relative">
              <input
                className="input w-full pr-10"
                type={showPassword ? 'text' : 'password'}
                placeholder={`รหัสผ่าน (อย่างน้อย ${PASSWORD_MIN} ตัว)`}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword((p) => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                tabIndex={-1}
                aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
              >
                {showPassword ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
              </button>
            </div>
            <input
              className="input w-full"
              type={showPassword ? 'text' : 'password'}
              placeholder="ยืนยันรหัสผ่าน"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button disabled={saving || password.length < PASSWORD_MIN || !confirmPassword} className="btn-primary w-full">
              {saving ? 'กำลังบันทึก...' : 'บันทึกและเข้าสู่ระบบ'}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
