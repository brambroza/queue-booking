import { PageShell } from '@/components/ui/page-shell';
import { ResourcesCrud } from '@/components/forms/resources-crud';

export default function ResourcesPage() {
  return (
    <PageShell title="Resources" description="จัดการโต๊ะอาหาร ห้องประชุม โซนบุฟเฟ่ต์ และทรัพยากรบริการ">
      <ResourcesCrud />
    </PageShell>
  );
}

