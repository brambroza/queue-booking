import { PageShell } from '@/components/ui/page-shell';
import { ReportsClient } from '@/components/dashboard/reports-client';

export default function ReportsPage() {
  return (
    <PageShell title="Reports" description="รายงานและ Export CSV">
      <ReportsClient />
    </PageShell>
  );
}
