import { PageShell } from '@/components/ui/page-shell';
import { ServicesCrud } from '@/components/forms/services-crud';

export default function ServicesPage() {
  return (
    <PageShell title="Services" description="บริการที่ลูกค้าเลือกได้เมื่อจองคิว รองรับการจองตามเวลาที่แน่นอน เวลายืดหยุ่น จำนวนต่อรอบ walk-in และแบบต้องยืนยันก่อน">
      <ServicesCrud />
    </PageShell>
  );
}
