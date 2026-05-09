import Link from 'next/link';

const features = [
  { title: 'LINE-first Booking', desc: 'ลูกค้าจองคิวผ่าน LINE OA และ LIFF ได้ในไม่กี่คลิก' },
  { title: 'Multi-tenant SaaS', desc: 'รองรับหลายร้าน หลายสาขา แยกข้อมูลปลอดภัยด้วย RLS' },
  { title: 'Real-time Operations', desc: 'จัดการคิว, แชท, รายงาน และสถานะบริการในหน้าจอเดียว' },
];

export default function HomePage() {
  return (
    <main className="min-h-screen px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="card overflow-hidden">
          <div className="grid gap-8 p-6 sm:p-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
            <div>
              <p className="inline-flex rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-600">
               Queue Booking
              </p>
              <h1 className="mt-4 text-3xl font-semibold leading-tight sm:text-5xl">
                ระบบจองคิวที่
                <br className="hidden sm:block" />
                เรียบง่ายและพร้อมใช้งานจริง
              </h1>
              <p className="mt-4 max-w-xl text-sm text-slate-600 sm:text-base">
                สำหรับร้านค้าและบริษัทที่ต้องการจัดการคิวผ่าน LINE แบบมืออาชีพ ตั้งค่าได้เอง รองรับหลายสาขา และขยายทีมได้ง่าย
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/register" className="btn-primary">เริ่มสมัครใช้งาน</Link>
                <Link href="/login" className="btn-outline">เข้าสู่ระบบ</Link>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-[linear-gradient(160deg,#ffffff,#f3f4f6)] p-5">
              <p className="text-xs uppercase tracking-wide text-slate-500">Today Snapshot</p>
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <span className="text-sm text-slate-500">Bookings</span>
                  <span className="text-lg font-semibold">124</span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <span className="text-sm text-slate-500">Serving Now</span>
                  <span className="text-lg font-semibold">18</span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <span className="text-sm text-slate-500">No-show Rate</span>
                  <span className="text-lg font-semibold">2.1%</span>
                </div>
              </div>
            </div>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          {features.map((f) => (
            <article key={f.title} className="card p-5">
              <h2 className="text-base font-semibold">{f.title}</h2>
              <p className="mt-2 text-sm text-slate-600">{f.desc}</p>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
