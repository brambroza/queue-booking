'use client';

import { FormEvent, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/components/ui/toast';

export function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { push } = useToast();
  const [loading, setLoading] = useState(false);
  const selectedPlan = searchParams.get('plan') ?? '';

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const payload = Object.fromEntries(formData.entries());

    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const json = await res.json();
    setLoading(false);

    if (!res.ok) {
      push(json.error ?? 'สมัครใช้งานไม่สำเร็จ', 'error');
      return;
    }

    push(json.message ?? 'สมัครสำเร็จ กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ');
    const email = String(formData.get('email') ?? '');
    router.push(`/verify-email?email=${encodeURIComponent(email)}`);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <input className="input" name="company_name" placeholder="ชื่อบริษัท" required />
      <input className="input" name="shop_name" placeholder="ชื่อร้าน" required />
      <input className="input" name="owner_name" placeholder="ชื่อเจ้าของ" required />
      <input className="input" name="phone" placeholder="เบอร์โทร" required />
      <input className="input" type="email" name="email" placeholder="Email" required />
      <input className="input" type="password" name="password" placeholder="Password" required />
      <input type="hidden" name="plan_name" value={selectedPlan} />
      <button disabled={loading} className="btn-primary w-full" type="submit">{loading ? 'กำลังสมัคร...' : 'สมัครใช้งาน'}</button>
    </form>
  );
}
