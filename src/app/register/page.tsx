import Link from 'next/link';
import { RegisterForm } from '@/components/auth/register-form';

export default function RegisterPage() {
  return (
    <main className="min-h-screen grid place-items-center p-4">
      <section className="card w-full max-w-md p-6">
        <h1 className="text-2xl font-bold">สมัครใช้งานร้านค้า</h1>
        <p className="mt-1 text-sm text-slate-600">สร้างบริษัท ร้าน และ shop_key อัตโนมัติ</p>
        <div className="mt-4">
          <RegisterForm />
        </div>
        <p className="mt-4 text-sm">มีบัญชีแล้ว? <Link className="text-brand-700" href="/login">เข้าสู่ระบบ</Link></p>
      </section>
    </main>
  );
}
