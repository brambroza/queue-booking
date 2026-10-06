import { PageShell } from '@/components/ui/page-shell';
import { FnbOrdersBoard } from '@/components/fnb/fnb-orders-board';

export default function FnbOrdersPage() {
  return (
    <PageShell title="ออเดอร์อาหาร" description="ออเดอร์ที่ลูกค้าสั่งจากบูท/โต๊ะ — กดรับ เสิร์ฟ หรือยกเลิก ลูกค้าจะได้รับแจ้งทาง LINE">
      <FnbOrdersBoard />
    </PageShell>
  );
}
