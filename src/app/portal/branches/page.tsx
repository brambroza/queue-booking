import { PageShell } from '@/components/ui/page-shell';
import { SimpleCrud } from '@/components/forms/simple-crud';
import { ADVANCE_WINDOW_OPTIONS } from '@/lib/booking/booking-window';

export default function BranchesPage() {
  return (
    <PageShell title="Branches" description="จัดการสาขา">
      <SimpleCrud
        endpoint="/api/branches"
        title="สาขา"
        // '' on both booking-window fields = unlimited (stored as NULL).
        defaults={{ active: true, open_time: '09:00', close_time: '18:00', booking_advance_window: '', booking_open_until: '' }}
        columns={[
          { key: 'branch_name', label: 'ชื่อสาขา' },
          { key: 'address', label: 'ที่อยู่' },
          { key: 'phone', label: 'เบอร์โทร' },
          { key: 'open_time', label: 'เวลาเปิด', type: 'time' },
          { key: 'close_time', label: 'เวลาปิด', type: 'time' },
          { key: 'active', label: 'เปิดใช้งาน', type: 'checkbox' },
          {
            key: 'booking_advance_window',
            label: 'จองล่วงหน้าได้',
            type: 'select',
            options: ADVANCE_WINDOW_OPTIONS,
            optional: true,
            hint: 'นับจากวันนี้ตามปฏิทิน',
          },
          {
            key: 'booking_open_until',
            label: 'เปิดจองถึงวันที่',
            type: 'date',
            optional: true,
            hint: 'เว้นว่าง = ไม่กำหนด ถ้าตั้งทั้งสองช่อง ใช้วันที่ถึงก่อน',
          },
          {
            key: 'layout_image_url',
            label: 'รูปผังสนาม / ผังร้าน',
            type: 'image',
            imageKind: 'branches',
            hint: 'ลูกค้ากดดูได้ตอนเลือกสนาม/ห้อง เพื่อดูว่าแต่ละจุดอยู่ตรงไหน',
          },
        ]}
      />
    </PageShell>
  );
}
