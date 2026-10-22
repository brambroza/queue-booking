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
        defaults={{ active: true, open_time: '09:00', close_time: '18:00', booking_advance_window: '', booking_open_until: '', booking_open_from: '', booking_release_at: '' }}
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
            key: 'booking_open_from',
            label: 'เปิดจองตั้งแต่วันที่',
            type: 'date',
            optional: true,
            hint: 'วันแรกที่ลูกค้าเลือกจองได้ (จองล่วงหน้าได้ตั้งแต่วันนี้) เว้นว่าง = ตั้งแต่วันนี้ ใช้คู่กับ "เปิดจองถึงวันที่" เป็นช่วง เช่น 23–25',
          },
          {
            key: 'booking_open_until',
            label: 'เปิดจองถึงวันที่',
            type: 'date',
            optional: true,
            hint: 'เว้นว่าง = ไม่กำหนด ถ้าตั้งทั้งสองช่อง ใช้วันที่ถึงก่อน',
          },
          {
            key: 'booking_release_at',
            label: 'เปิดให้จองเวลา (ห้องรอ)',
            type: 'datetime',
            optional: true,
            hint: 'เวลาไทย ก่อนถึงเวลานี้ลูกค้าเห็นหน้านับถอยหลังและยังกดจองไม่ได้ ไม่ต้องกดรีเฟรช — ใช้เมื่อประกาศเปิดจองพร้อมกัน เช่น 19:00 เว้นว่าง = เปิดตลอด',
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
