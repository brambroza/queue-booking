# วิดีโอโปรโมต Facebook

คลิปสรุป feature ของ QueueBooking LINE มี 2 สัดส่วน เนื้อหาและจังหวะเหมือนกัน

| สัดส่วน | ไฟล์ผลลัพธ์ | ขนาด | ใช้กับ | หน้า layout |
|---|---|---|---|---|
| 9:16 | `out/queuebooking-facebook-9x16.mp4` | 1080x1920 | Reels / Stories | `index.html` |
| 16:9 | `out/queuebooking-facebook-16x9.mp4` | 1920x1080 | โพสต์ feed, ปกเพจ, YouTube, จอนำเสนอ | `index-16x9.html` |

| | |
|---|---|
| รูปแบบ | 30 fps, H.264 (`yuv420p`), 40 วินาที |
| เสียง | track เงียบ (AAC) — ใส่เพลงเองตอนโพสต์ใน Facebook |
| ภาพ | screenshot จริงจาก `public/images/product/` และ `public/images/landing/` |

## ลำดับฉาก

| # | เวลา (วินาที) | ข้อความ |
|---|---|---|
| 1 | 0-4 | ตอบแชทจองคิวทั้งวัน? |
| 2 | 4-10 | ลูกค้าจองผ่าน LINE ได้เอง |
| 3 | 10-15 | รับมัดจำผ่าน PromptPay QR |
| 4 | 15-20 | เรียกคิวคลิกเดียว แจ้งลูกค้าทาง LINE |
| 5 | 20-25 | จอแสดงคิวขึ้น TV หน้าร้าน |
| 6 | 25-30 | เห็นยอดคิวและรายงานทันที |
| 7 | 30-34 | ครบในที่เดียว |
| 8 | 34-40 | เริ่มใช้ฟรี + QR เพิ่มเพื่อน LINE |

## Render ใหม่

ต้องมี `ffmpeg` และ `playwright-core` (script หาจาก npx cache เอง ถ้ายังไม่มีให้รัน `npx playwright --version` หนึ่งครั้ง)
ไม่ต้อง `npm install` และไม่ต้องรัน dev server

```bash
cd docs/marketing/facebook-video
node render.mjs --sample                 # ภาพนิ่งฉากละ 1-2 ภาพ ไว้ตรวจก่อน (9:16)
node render.mjs                          # render 9:16 ใช้เวลาประมาณ 3 นาที
node render.mjs --format 16x9 --sample   # ภาพนิ่งของ 16:9
node render.mjs --format 16x9            # render 16:9
```

แก้ข้อความแล้วต้อง render ใหม่ทั้ง 2 สัดส่วน

ตัวแปรที่ตั้งได้: `FRAMES_DIR` (ที่เก็บเฟรมชั่วคราว), `PLAYWRIGHT_CORE` (path ของ package), `FFMPEG`

## ดูตัวอย่างในเบราว์เซอร์

เปิด `index.html` หรือ `index-16x9.html` ได้เลย คลิปจะเล่นวนตามเวลาจริง ใส่ `?t=12` ต่อท้าย URL เพื่อหยุดที่วินาทีที่ 12

## แก้ข้อความหรือจังหวะ

| ต้องการแก้ | ไฟล์ | ตำแหน่ง |
|---|---|---|
| ข้อความ, ตำแหน่ง, ขนาด | `index.html` และ `index-16x9.html` (แก้ทั้งคู่) | `<section class="scene">` ของฉากนั้น |
| เวลาเริ่มของแต่ละฉาก | `timeline.js` | `SCENES` |
| ความยาวรวม | `timeline.js` | `DURATION` |
| จังหวะการเคลื่อนไหวในฉาก | `timeline.js` | `RENDER` (เวลานับจากต้นฉาก) |
| การเลื่อนภาพ portal ในฉาก 4 และ 6 | หน้า layout แต่ละไฟล์ | `window.PANS` |

`timeline.js` ใช้ร่วมกันทั้ง 2 สัดส่วน id ของ element ในทั้ง 2 หน้าจึงต้องตรงกัน

ค่าใน `window.PANS` ต้องไม่เกิน (ขนาดภาพ x scale) ลบขนาดกรอบ ไม่อย่างนั้นกรอบจะเห็นพื้นที่ว่าง

ทุกเฟรมคำนวณจาก `window.renderAt(วินาที)` ห้ามใช้ CSS animation หรือ `setTimeout` เพราะ render ทีละเฟรมจะจับไม่ได้

เฉพาะ 9:16: ข้อความหลักต้องอยู่ระหว่าง y = 250 ถึง 1570 เพราะ Reels มีปุ่มและ caption บังด้านบนและด้านล่าง

## ข้อความที่ห้ามใส่

ตรวจกับโค้ดแล้วว่ายังไม่เป็นจริง ณ 2026-09-29

| ข้อความ | เหตุผล |
|---|---|
| ตรวจสลิป / ยืนยันสลิปอัตโนมัติ | `resolveSlipProvider` ยังคืน `null` ทุกสลิปต้องให้พนักงานอนุมัติ |
| จ่ายผ่านแอป SCB Easy / K PLUS โดยตรง | field ใน `src/lib/payments/deeplink/` ยัง mark `VERIFY` |
| ซัพพอร์ต 24/7, ตอบใน 1 ชม. | ไม่มีอะไรรองรับในระบบ |
| เริ่มใช้ฟรี 14 วัน | แพ็กเกจจริงคือ Starter ฟรีตลอด 50 คิว/เดือน |
| Auto Reply / Chat Inbox เฉพาะบางแพ็กเกจ | โค้ดยังไม่ได้ล็อกตามแพ็กเกจ |

ราคาอ้างจาก `pricingPlans` ใน `src/components/public/content.ts` ถ้าราคาเปลี่ยนต้องแก้ฉาก 8 แล้ว render ใหม่
