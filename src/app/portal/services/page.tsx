import { PageShell } from '@/components/ui/page-shell';
import { SimpleCrud } from '@/components/forms/simple-crud';

export default function ServicesPage() {
  return (
    <PageShell title="Services" description="จัดการบริการ">
      <SimpleCrud
        endpoint="/api/services"
        title="บริการ"
        defaults={{ duration_minutes: 30, capacity_per_slot: 1, price: 0, active: true }}
        columns={[
          { key: 'service_name', label: 'ชื่อบริการ' },
          { key: 'duration_minutes', label: 'เวลา(นาที)', type: 'number' },
          { key: 'capacity_per_slot', label: 'ความจุต่อสล็อต', type: 'number' },
          { key: 'price', label: 'ราคา', type: 'number' },
          { key: 'active', label: 'เปิดใช้งาน', type: 'checkbox' },
        ]}
      />
    </PageShell>
  );
}
