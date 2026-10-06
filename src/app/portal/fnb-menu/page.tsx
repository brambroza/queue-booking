import { PageShell } from '@/components/ui/page-shell';
import { FnbMenuManager } from '@/components/fnb/fnb-menu-manager';

export default function FnbMenuPage() {
  return (
    <PageShell title="เมนูอาหาร" description="ตั้งเมนูอาหารเครื่องดื่มให้ลูกค้าสั่งจากบูท/โต๊ะผ่าน LINE — เปิด-ปิดได้ทั้งร้าน (แพ็กเกจ Professional ขึ้นไป)">
      <FnbMenuManager />
    </PageShell>
  );
}
