'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/toast';

export function LoginForm() {
  const { push } = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    try {
      const supabase = createClient();
      const formData = new FormData(e.currentTarget);
      const email = String(formData.get('email') ?? '');
      const password = String(formData.get('password') ?? '');

      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        push(error.message, 'error');
        return;
      }

      push('เข้าสู่ระบบสำเร็จ');
      router.push('/portal/dashboard');
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch';
      if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
        push('เชื่อมต่อ Supabase ไม่ได้ (Network). ตรวจ URL/ANON key ใน .env และลองปิด VPN/AdBlock', 'error');
      } else {
        push(message, 'error');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <input className="input" type="email" name="email" placeholder="Email" required />
      <input className="input" type="password" name="password" placeholder="Password" required />
      <button disabled={loading} className="btn-primary w-full" type="submit">{loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}</button>
    </form>
  );
}
