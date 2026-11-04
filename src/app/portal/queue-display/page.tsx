import { PageShell } from '@/components/ui/page-shell';
import { SignageDesignerClient } from '@/components/signage/designer/signage-designer-client';
import { SheetSourceCard } from '@/components/signage/sheet-source-card';

export default function QueueDisplayPage() {
  return (
    <PageShell title="จอแสดงคิว (Digital Signage)" description="เลือกเทมเพลต ปรับสี แล้วเปิดบนจอ TV หน้าร้าน ระบบอัปเดตคิวให้อัตโนมัติ">
      <SheetSourceCard />
      <SignageDesignerClient />
    </PageShell>
  );
}
