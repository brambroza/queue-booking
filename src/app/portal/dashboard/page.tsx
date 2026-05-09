import { createClient } from '@/lib/supabase/server';
import { PageShell } from '@/components/ui/page-shell';
import { DashboardCharts } from '@/components/dashboard/dashboard-charts';

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <PageShell title="Dashboard" description="สรุปข้อมูลร้านและแนวโน้มคิว">
      <DashboardCharts />
      <div className="card p-4 text-sm text-slate-600">Logged in as: {user?.email}</div>
    </PageShell>
  );
}
