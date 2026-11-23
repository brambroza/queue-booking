# Render social images (blog 2026-11-23)

```bash
# Chrome ต้องติดตั้งอยู่ (ใช้ channel 'chrome'); playwright จาก npx cache
node render.mjs ../              # compare + spa
node render.mjs ../ spa          # เฉพาะธีมเดียว
```

- `template.html?t=compare|spa&s=sq|x|fb` (ธีมเดิม hero|noshow|free|board ยังใช้ได้)
- แก้ข้อความที่ `T.compare` และ `T.spa` ท้ายไฟล์ ข้อมูลในตารางต้องตรงกับ blog `online-queue-booking-software-types-compared`
- ฟอนต์ Kanit และภาพ product อ่านจาก `public/` ของโปรเจกต์ (path hardcode เป็น `file://`)
