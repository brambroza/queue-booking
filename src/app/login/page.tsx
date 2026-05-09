import Link from 'next/link';
import { LoginForm } from '@/components/auth/login-form';

export default function LoginPage() {
  return (
    <main className="min-h-screen grid place-items-center p-4">
      <section className="card w-full max-w-md p-6">
        <h1 className="text-2xl font-bold">เข้าสู่ระบบ</h1>
        <p className="mt-1 text-sm text-slate-600">สำหรับเจ้าของร้านและพนักงาน</p>
        <div className="mt-4">
          <LoginForm />
        </div>
        <p className="mt-4 text-sm">ยังไม่มีบัญชี? <Link className="text-brand-700" href="/register">สมัครใช้งาน</Link></p>
      </section>
    </main>
  );
}
