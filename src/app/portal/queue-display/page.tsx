import { PageShell } from '@/components/ui/page-shell';
import { QueueDisplayClient } from '@/components/bookings/queue-display-client';

export default function QueueDisplayPage() {
  return (
    <PageShell title="Queue Display" description="หน้าจอแสดงคิวหน้าร้าน (Now/Next)">
      <QueueDisplayClient />
    </PageShell>
  );
}

