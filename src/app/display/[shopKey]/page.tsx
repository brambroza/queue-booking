'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

type DisplayData = {
  date: string;
  shop: { name: string; demo_mode_enabled: boolean; demo_business_type?: string | null };
  now_calling: { queue_number: string; service_name: string; resource_name: string | null; customer_name: string; start_time: string } | null;
  next_queue: Array<{ queue_number: string; service_name: string; resource_name: string | null; customer_name: string; start_time: string }>;
  waiting_queue: Array<{ queue_number: string; resource_name: string | null; customer_name: string }>;
};

export default function PublicDisplayPage() {
  const { shopKey } = useParams<{ shopKey: string }>();
  const [data, setData] = useState<DisplayData | null>(null);
  const [clock, setClock] = useState('');

  async function load() {
    const res = await fetch(`/api/public/shop/${encodeURIComponent(shopKey)}/display`, { cache: 'no-store' });
    const json = await res.json();
    if (res.ok) setData(json.data);
  }

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 10000);
    return () => clearInterval(t);
  }, [shopKey]);

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString('th-TH', { hour12: false }));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <main className="min-h-screen bg-[#070d07] text-[#eef8ee] p-4 md:p-6">
      <section className="mx-auto max-w-7xl">
        <div className="mb-4 flex items-center justify-between rounded-2xl border border-[#243424] bg-[#101910] px-4 py-3">
          <div>
            <p className="text-sm text-[#89a589]">{data?.shop?.name ?? 'Queue Display'}</p>
            {data?.shop?.demo_mode_enabled ? <p className="text-xs text-amber-300">Demo Mode</p> : null}
          </div>
          <p className="font-mono text-2xl text-[#4ade80]">{clock}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <article className="rounded-2xl border border-[#2b452b] bg-[#0d160d] p-5">
            <p className="text-sm text-[#8ca98c]">Now Calling</p>
            {data?.now_calling ? (
              <div className="mt-2">
                <p className="text-7xl font-black tracking-tight text-[#4ade80]">{data.now_calling.queue_number}</p>
                <p className="text-lg">{data.now_calling.service_name}</p>
                {data.now_calling.resource_name ? <p className="text-[#9fc59f]">{data.now_calling.resource_name}</p> : null}
              </div>
            ) : <p className="mt-2 text-slate-400">ยังไม่มีคิวที่กำลังเรียก</p>}
          </article>

          <article className="rounded-2xl border border-[#2b452b] bg-[#0d160d] p-5">
            <p className="text-sm text-[#8ca98c]">Next Queue</p>
            <div className="mt-2 space-y-2">
              {(data?.next_queue ?? []).map((q) => (
                <div key={`${q.queue_number}-${q.start_time}`} className="rounded-xl bg-[#111f11] px-3 py-2">
                  <div className="flex justify-between">
                    <p className="text-2xl font-bold">{q.queue_number}</p>
                    <p className="text-sm text-[#8ca98c]">{q.start_time}</p>
                  </div>
                  <p className="text-sm">{q.service_name}</p>
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}

