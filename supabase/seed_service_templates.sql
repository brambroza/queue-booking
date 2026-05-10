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
  sort_order
) values
-- ร้านตัดผม
('ร้านตัดผม', 'ตัดผมชาย', 'fixed_slot', 30, null, null, 1, false, false, 10),
('ร้านตัดผม', 'ทำสีผม', 'flexible_duration', null, 90, 180, 1, false, false, 20),
-- คลินิก
('คลินิก', 'ตรวจทั่วไป', 'fixed_slot', 15, null, null, 1, false, false, 30),
('คลินิก', 'พบแพทย์เฉพาะทาง', 'request_approval', null, null, null, 1, true, false, 40),
-- ร้านอาหาร
('ร้านอาหาร', 'จองโต๊ะ', 'capacity_based', null, null, null, 4, false, false, 50),
('ร้านอาหาร', 'Walk-in', 'walk_in', null, null, null, 1, false, true, 60),
-- ทีมช่างติดตั้ง
('ทีมช่างติดตั้ง', 'ติดตั้งกล้องวงจรปิด', 'request_approval', null, null, null, 1, true, false, 70),
('ทีมช่างติดตั้ง', 'ตรวจหน้างาน', 'flexible_duration', null, 60, 180, 1, false, false, 80),
-- Seed list requested
('ร้านตัดผม', 'ตัดผมชาย', 'fixed_slot', 30, null, null, 1, false, false, 90),
('ร้านทำเล็บ', 'ทำเล็บ', 'fixed_slot', 60, null, null, 1, false, false, 100),
('คลินิก', 'ตรวจทั่วไป', 'fixed_slot', 15, null, null, 1, false, false, 110),
('ร้านซ่อมมือถือ', 'ซ่อมมือถือ', 'request_approval', null, null, null, 1, true, false, 120),
('ร้านซ่อมรถ', 'เปลี่ยนยางรถ', 'request_approval', null, null, null, 1, true, false, 130),
('ร้านอาหาร', 'จองโต๊ะ', 'capacity_based', null, null, null, 4, false, false, 140),
('งานราชการ', 'ติดต่อราชการ', 'request_approval', null, null, null, 1, true, false, 150),
('Consult', 'ปรึกษาธุรกิจ', 'flexible_duration', null, 30, 120, 1, false, false, 160),
('ทีมช่างติดตั้ง', 'ติดตั้งอินเทอร์เน็ต', 'request_approval', null, null, null, 1, true, false, 170)
on conflict do nothing;
