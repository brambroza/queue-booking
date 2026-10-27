import { PageShell } from '@/components/ui/page-shell';
import { ShopShowcaseAdmin } from '@/components/showcase/shop-showcase-admin';

export default function ShopShowcasePage() {
  return (
    <PageShell title="Shop Showcase" description="ตรวจร้านที่ยินยอมให้แสดงบนหน้าแรก อนุมัติ ปักร้านแนะนำ หรือนำออก">
      <ShopShowcaseAdmin />
    </PageShell>
  );
}
