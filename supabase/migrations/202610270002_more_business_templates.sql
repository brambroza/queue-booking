-- Starter services for the business types added to the register form on
-- 2026-10-27. Category values equal the normalized business_type keys in
-- src/lib/line/rich-menu/business-types.ts. seedNewShop copies the first
-- three (by sort_order) into a new shop, so each category has three rows.
-- Durations are minutes; request_approval rows use min/max instead of a fixed length.

insert into public.service_templates (
  business_category,
  service_name,
  booking_mode,
  duration_minutes,
  min_duration_minutes,
  max_duration_minutes,
  capacity_per_slot,
  requires_approval,
  allow_walk_in,
  default_duration_minutes,
  default_capacity_per_slot,
  sort_order
)
select v.business_category,
       v.service_name,
       v.booking_mode,
       v.duration_minutes,
       v.min_duration_minutes,
       v.max_duration_minutes,
       v.capacity_per_slot,
       v.requires_approval,
       v.allow_walk_in,
       v.default_duration_minutes,
       v.default_capacity_per_slot,
       v.sort_order
from (values
  ('spa', 'นวดไทย', 'fixed_slot', 60, null::int, null::int, 1, false, false, 60, 1, 400),
  ('spa', 'นวดน้ำมัน / อโรมา', 'fixed_slot', 90, null::int, null::int, 1, false, false, 90, 1, 410),
  ('spa', 'นวดเท้า', 'fixed_slot', 60, null::int, null::int, 1, false, false, 60, 1, 420),

  ('sports_court', 'เช่าสนาม (ชั่วโมง)', 'fixed_slot', 60, null::int, null::int, 1, false, false, 60, 1, 430),
  ('sports_court', 'เรียนกับโค้ช', 'fixed_slot', 60, null::int, null::int, 1, false, false, 60, 1, 440),
  ('sports_court', 'ก๊วน / เล่นรวม', 'capacity_based', 120, null::int, null::int, 12, false, false, 120, 12, 450),

  ('outdoor', 'รอบเล่นกลุ่ม', 'capacity_based', 120, null::int, null::int, 20, false, false, 120, 20, 460),
  ('outdoor', 'เหมาสนาม (กลุ่มส่วนตัว)', 'request_approval', null::int, 120, 360, 1, true, false, null::int, 1, 470),
  ('outdoor', 'วอล์กอินหน้างาน', 'walk_in', null::int, null::int, null::int, 30, false, true, null::int, 30, 480),

  ('pet', 'อาบน้ำ-ตัดขน', 'fixed_slot', 90, null::int, null::int, 1, false, false, 90, 1, 490),
  ('pet', 'ตรวจสุขภาพ / ฉีดวัคซีน', 'fixed_slot', 30, null::int, null::int, 1, false, false, 30, 1, 500),
  ('pet', 'ฝากเลี้ยง', 'request_approval', null::int, 240, 1440, 1, true, false, null::int, 1, 510),

  ('beauty_clinic', 'ปรึกษาแพทย์', 'fixed_slot', 30, null::int, null::int, 1, false, false, 30, 1, 520),
  ('beauty_clinic', 'ทรีตเมนต์ / หัตถการ', 'fixed_slot', 60, null::int, null::int, 1, false, false, 60, 1, 530),
  ('beauty_clinic', 'ทำฟัน / ขูดหินปูน', 'fixed_slot', 45, null::int, null::int, 1, false, false, 45, 1, 540),

  ('car_care', 'ล้างรถ', 'fixed_slot', 60, null::int, null::int, 1, false, false, 60, 1, 550),
  ('car_care', 'ล้าง + ดูดฝุ่นภายใน', 'fixed_slot', 90, null::int, null::int, 1, false, false, 90, 1, 560),
  ('car_care', 'เคลือบแก้ว / เคลือบสี', 'request_approval', null::int, 180, 480, 1, true, false, null::int, 1, 570),

  ('photo_studio', 'ถ่ายภาพบุคคล / โปรไฟล์', 'fixed_slot', 60, null::int, null::int, 1, false, false, 60, 1, 580),
  ('photo_studio', 'เช่าสตูดิโอ (ชั่วโมง)', 'fixed_slot', 60, null::int, null::int, 1, false, false, 60, 1, 590),
  ('photo_studio', 'ถ่ายนอกสถานที่', 'request_approval', null::int, 60, 480, 1, true, false, null::int, 1, 600),

  ('tutoring', 'คลาสกลุ่ม', 'capacity_based', 90, null::int, null::int, 10, false, false, 90, 10, 610),
  ('tutoring', 'เรียนตัวต่อตัว', 'fixed_slot', 60, null::int, null::int, 1, false, false, 60, 1, 620),
  ('tutoring', 'ทดลองเรียน', 'fixed_slot', 60, null::int, null::int, 1, false, false, 60, 1, 630),

  ('event', 'ลงทะเบียนเข้างาน', 'capacity_based', 60, null::int, null::int, 100, false, false, 60, 100, 640),
  ('event', 'คิวกิจกรรมในงาน', 'capacity_based', 15, null::int, null::int, 5, false, false, 15, 5, 650),
  ('event', 'จองบูธ / พื้นที่ในงาน', 'request_approval', null::int, 240, 720, 1, true, false, null::int, 1, 660)
) as v(
  business_category,
  service_name,
  booking_mode,
  duration_minutes,
  min_duration_minutes,
  max_duration_minutes,
  capacity_per_slot,
  requires_approval,
  allow_walk_in,
  default_duration_minutes,
  default_capacity_per_slot,
  sort_order
)
where not exists (
  select 1
  from public.service_templates t
  where t.business_category = v.business_category
    and t.service_name = v.service_name
);
