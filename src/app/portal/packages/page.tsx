import { Suspense } from 'react';
import { PageShell } from '@/components/ui/page-shell';
import { PackagesPageClient } from '@/components/packages/packages-page-client';

export default function PackagesPage() {
  return (
    <PageShell title="แพ็กเกจชั่วโมง" description="ขายชั่วโมงล่วงหน้า (เช่น 10 ชม.) แล้วตัดทีละรอบตอนลูกค้าจองคิว ลูกค้าซื้อเองใน LINE หรือขายที่หน้าร้านก็ได้">
      {/* useSearchParams (?id= from a notification) needs a Suspense boundary. */}
      <Suspense fallback={null}>
        <PackagesPageClient />
      </Suspense>
    </PageShell>
  );
}
