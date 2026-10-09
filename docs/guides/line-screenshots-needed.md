# ภาพหน้าจอ LINE ที่ต้องถ่ายส่งให้ทีม (สำหรับคู่มือ line-setup-guide.pdf)

วางไฟล์ไว้ที่ `docs/guides/images/line/` ตามชื่อด้านล่าง แล้วรัน `docs/guides/build.sh` เพื่อสร้าง PDF ใหม่
ภาพไหนยังไม่มี ในคู่มือจะขึ้นกรอบ "รอภาพ: ชื่อไฟล์" แทน ไม่ทำให้สร้าง PDF ไม่ได้

## วิธีถ่าย
- ถ่ายทั้งหน้าต่างเบราว์เซอร์ (macOS: `Shift+Cmd+4` แล้วกด Space คลิกหน้าต่าง) ขนาดอย่างน้อย 1280 px กว้าง
- ใช้โหมดสว่าง (light) ภาษาอังกฤษหรือไทยก็ได้
- **ก่อนส่ง ปิดบังค่าลับทุกครั้ง**: Channel secret, Channel access token, และ Channel ID ไม่จำเป็นต้องเห็นเต็ม ให้ปิดด้วยสีทึบ (ไม่ใช่เบลอ) หรือกดซ่อนในหน้าจอก่อนถ่าย
- ไม่ต้องวาดกรอบหรือลูกศรเอง ทีมจะใส่หมายเลขและไฮไลต์ให้ในคู่มือ
- รูปแบบ PNG หรือ JPG

## รายการภาพ

| ไฟล์ | หน้าจอ | สิ่งที่ต้องเห็นในภาพ |
|---|---|---|
| `line-01-oa-create.png` | LINE OA Manager → สร้างบัญชีทางการ | ฟอร์มกรอกชื่อร้าน ประเภทธุรกิจ อีเมล |
| `line-02-messaging-api.png` | OA Manager → Settings → Messaging API | ปุ่ม Enable Messaging API หรือสถานะ Enabled พร้อมชื่อ Provider |
| `line-03-dev-console-channel.png` | LINE Developers Console → Provider ของร้าน | รายการ channel ที่มี Messaging API channel ของร้าน |
| `line-04-channel-secret.png` | Developers Console → Basic settings | ส่วน "Channel secret" (ปิดบังค่า) |
| `line-05-access-token.png` | Developers Console → Messaging API | ส่วน "Channel access token (long-lived)" และปุ่ม Issue (ปิดบังค่า token) |
| `line-06-webhook.png` | Developers Console → Messaging API → Webhook settings | ช่อง Webhook URL ที่ใส่แล้ว, สวิตช์ Use webhook เป็น ON, และผล Verify ขึ้น Success |
| `line-07-response-settings.png` | OA Manager → Settings → Response settings | Chat ON, Webhook ON, Auto-reply messages OFF, Greeting messages ON |
| `line-08-liff-add.png` | Developers Console → LIFF → Add | ฟอร์มสร้าง LIFF app กรอกครบ (ชื่อ, Size Full, Endpoint URL, Scopes profile+openid, Bot link ON) |
| `line-09-liff-list.png` | Developers Console → LIFF | รายการ LIFF app 2 ตัว (จองคิว / สมาชิก) พร้อม LIFF ID |
| `line-10-rich-menu-chat.jpg` | มือถือ: แชท LINE OA ของร้าน | Rich Menu ที่เผยแพร่จากระบบขึ้นด้านล่างแชท (ถ่ายหน้าจอมือถือ) |

## หมายเหตุ
- ภาพ `line-10` เป็นภาพเดียวที่ถ่ายจากมือถือ ที่เหลือถ่ายจากคอมพิวเตอร์
- ถ้าถ่ายหน้าจอได้ไม่ครบ ส่งเท่าที่มีได้ก่อน คู่มือสร้างได้ทันทีและเติมภาพภายหลังได้
