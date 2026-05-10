import Link from 'next/link';
import { redirect } from 'next/navigation';

export default async function LiffBookingClientEntry({
  searchParams,
}: {
  searchParams: Promise<{ shopKey?: string; shop_key?: string; shopId?: string; shop_id?: string; tab?: string; view?: string }>;
}) {
  const qs = await searchParams;
  const ref = qs.shopKey ?? qs.shop_key ?? qs.shopId ?? qs.shop_id;
  const tab = (qs.tab ?? qs.view ?? '').toLowerCase();

  if (ref) {
    if (tab === 'account' || tab === 'member') {
      redirect(`/liff/${encodeURIComponent(ref)}/member`);
    }
    redirect(`/liff/${encodeURIComponent(ref)}`);
  }

  return (
    <main className="min-h-screen p-6">
      <section className="card mx-auto max-w-lg p-6 space-y-3">
        <h1 className="text-xl font-semibold">LIFF Booking</h1>
        <p className="text-sm text-slate-600">ลิงก์นี้ต้องมี `shop_key` หรือ `shop_id` เพื่อระบุร้านค้า</p>
        <p className="text-xs text-slate-500">ตัวอย่าง: `/liff/booking-client?shop_key=SHOP-XXXXXX`</p>
        <p className="text-xs text-slate-500">หรือ: `/liff/booking-client?shop_id=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`</p>
        <Link className="btn-outline" href="/">กลับหน้าหลัก</Link>
      </section>
    </main>
  );
}
