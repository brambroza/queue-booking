import { PageShell } from '@/components/ui/page-shell';
import { ServicesCrud } from '@/components/forms/services-crud';

export default function ServicesPage() {
  return (
    <PageShell title="Services" description="รองรับ fixed slot, flexible duration, capacity-based, walk-in และ request approval">
      <ServicesCrud />
    </PageShell>
  );
}
