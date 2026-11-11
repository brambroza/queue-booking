# Render social images

```bash
# Chrome ต้องติดตั้งอยู่ (ใช้ channel 'chrome'); playwright จาก npx cache
node render.mjs ../  # output ไปโฟลเดอร์แม่
```

- `template.html?t=hero|noshow|free|board&s=sq|x|fb` — แก้ copy ในอ็อบเจกต์ `T`
- ฟอนต์ Kanit และภาพ product อ่านจาก `public/` ของโปรเจกต์ (path ถูก hardcode เป็น `file://` ใน template)
- `render.mjs` ชี้ playwright ไปที่ `~/.npm/_npx/.../playwright` เพราะ `node_modules` ของโปรเจกต์ยังไม่ได้ install — ถ้ารัน `npm install` แล้วให้เปลี่ยนเป็น `require('playwright')`
