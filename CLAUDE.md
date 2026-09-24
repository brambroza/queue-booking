# CLAUDE.md — LINE Queue Booking SaaS (Queue)

## Project Overview

ระบบจองคิวแบบ SaaS สำหรับร้านค้า SME ไทย (multi-tenant)
ลูกค้าจองผ่าน LINE LIFF / LINE Chatbot — เจ้าของร้านจัดการผ่าน Portal

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 App Router + TypeScript |
| UI | Tailwind CSS (public) + MUI v7 (portal) |
| Auth | Supabase Auth |
| Database | Supabase PostgreSQL + RLS |
| Deployment | Vercel |
| Integration | LINE LIFF, LINE Webhook, SMTP (Nodemailer) |

---

## Critical Files — อ่านก่อนทำงานทุกครั้ง

| ไฟล์ | หน้าที่ |
|---|---|
| `src/lib/auth/context.ts` | RBAC guard — ใช้ `requireAuthContext({ roles: [...] })` ทุก API route |
| `src/lib/supabase/server.ts` | Supabase server client (ใช้ใน Server Component/Route) |
| `src/lib/supabase/admin.ts` | Service-role client — ใช้เฉพาะเมื่อ bypass RLS จำเป็น |
| `src/types/db.ts` | AppRole, BookingStatus, ApiResponse |
| `middleware.ts` | Redirect `/portal/*` ถ้าไม่ได้ login |
| `supabase/rls.sql` | RLS policy หลัก |
| `supabase/migrations/` | Schema migrations ทั้งหมด |

---

## Roles

```
super_admin → shop_owner → branch_manager → staff → customer
```

RBAC ทำผ่าน `requireAuthContext({ roles: ['shop_owner', 'branch_manager'] })` ใน route handler

---

## Tenant Scope (Multi-tenant Rules)

**ทุก query ที่ดึงข้อมูลร้าน ต้องมี `company_id` หรือ `shop_id`**

```ts
// ถูก
.eq('company_id', profile.company_id)
.eq('shop_id', profile.shop_id)

// ผิด — cross-tenant data leak
.select('*').eq('id', someId)
```

---

## Project Structure

```
src/
├── app/
│   ├── api/                    # API Routes (route.ts)
│   │   ├── public/shop/[shopKey]/  # Public LIFF endpoints
│   │   ├── admin/              # super_admin only
│   │   └── line/webhook/[shopKey]/ # LINE Webhook
│   ├── portal/                 # Backoffice (shop owner/staff)
│   ├── liff/[shopKey]/         # LIFF booking (mobile-first)
│   ├── display/[shopKey]/      # Queue signage (TV display)
│   └── (public pages)/         # Landing, pricing, blog, use-cases
├── components/
│   ├── forms/                  # CRUD form components (*-crud.tsx)
│   ├── layout/                 # portal-frame, portal-nav, topbar
│   ├── bookings/               # Queue board, calendar, display client
│   ├── demo/                   # Demo sandbox components
│   └── public/                 # Landing page sections
├── lib/
│   ├── auth/                   # requireAuthContext, session, schemas
│   ├── supabase/               # client, server, admin
│   ├── booking/                # queue-number, slot schemas
│   ├── line/                   # webhook client, messages, signature
│   ├── notifications/          # createNotification helpers
│   ├── i18n/                   # i18n client/server/provider
│   └── demo/                   # sandbox helpers
├── types/
│   └── db.ts                   # AppRole, BookingStatus, ApiResponse
└── services/
```

---

## API Routes

### Portal (ต้องมี auth context)
| Route | Resource |
|---|---|
| `/api/bookings` | Booking CRUD + status update |
| `/api/branches` | Branch CRUD |
| `/api/services` | Service CRUD |
| `/api/staff` | Staff management |
| `/api/customers` | Customer list |
| `/api/resources` | Resource management |
| `/api/working-hours` | Shop working hours |
| `/api/holidays` | Holiday blocks |
| `/api/calendar` | Booking timeline (grouped by date) |
| `/api/dashboard` | 14-day trend + status distribution |
| `/api/reports` | Range report (`preset=today|tomorrow|next7|week|month|last7|last30|custom`, max 92 days): KPI, by_day/by_hour/by_status, services/branches/staff, booking list (cap 1,000) · `mode=csv&group=day|staff|bookings` |
| `/api/notifications` | Notification center |
| `/api/chat-inbox` | LINE chat inbox + push reply |
| `/api/line-settings` | LINE OA configuration |
| `/api/settings` | Shop settings |
| `/api/shop-display-settings` | Customer-facing flags on `shops`: `show_service_duration`, `one_booking_per_day` (GET both; PATCH keys optional) |
| `/api/shop-profile` | Shop profile |
| `/api/shop-payment-settings` | Omise + bank transfer settings |
| `/api/shop-payment-settings/deeplink` | Bank deeplink (SCB/KBank) credentials per shop + `/test` connection check |
| `/api/payments/webhook` | Omise webhook (shared secret `?key=`) |
| `/api/payments/bank/[provider]/webhook/[shopKey]` | Bank deeplink confirmation (per-shop secret `?key=`, verified by inquiry) |
| `/api/me-profile` | Current user profile |
| `/api/available-slots` | Slot availability check |
| `/api/service-templates` | Service templates |
| `/api/demo-sandbox` | Demo mode management |
| `/api/i18n/*` | i18n translations management |
| `/api/rich-menu` | Rich menu builder state (GET) + save `business_type` / `rich_menu_config` (PATCH) |
| `/api/rich-menu/image` | Upload rendered rich menu PNG/JPEG (2500×1686 / 2500×843, ≤1 MB) → `shop-assets` bucket |
| `/api/rich-menu/publish` | POST = create rich menu on LINE + upload image + set default; DELETE = unpublish |
| `/api/shop-assets/image` | Upload one photo (`kind=resources\|services\|branches`, ≤5 MB, JPEG/PNG/WebP sniffed, re-encoded to JPEG ≤1600px, EXIF stripped) → public `shop-assets` bucket, returns `{ url }` only — no DB write |

### Public (ไม่ต้องมี auth)
| Route | Resource |
|---|---|
| `/api/public/shop/[shopKey]/meta` | Shop metadata for LIFF |
| `/api/public/shop/[shopKey]/slots` | Slot list incl. full + past slots (`get_slot_availability`: `capacity`, `booked_count`, `remaining_capacity`; server adds `is_past` via `isSlotPast` in `src/lib/booking/slot-time.ts`, Bangkok clock; `meta.open_slots`, `meta.today`) — LIFF greys full as "เต็ม N/N", past as "ผ่านแล้ว"; `/book` refuses past slots 400 `code: slot_past`; chatbot + portal `/api/available-slots` still use `get_available_slots` (open only, no past check) |
| `/api/public/shop/[shopKey]/book` | Create booking (LIFF) |
| `/api/public/shop/[shopKey]/cancel-booking` | Cancel booking |
| `/api/public/shop/[shopKey]/acknowledge-booking` | Customer acknowledges a shop-initiated change (mirror of the LINE `ack_change` postback) |
| `/api/public/shop/[shopKey]/check-in` | Customer "ฉันมาถึงแล้ว" → `checked_in` (booking day only, owner-checked) |
| `/api/public/shop/[shopKey]/payment/status` | Payment state for LIFF panel (heals missed bank webhooks) |
| `/api/public/shop/[shopKey]/payment/slip` | Slip upload |
| `/api/public/shop/[shopKey]/payment/deeplink` | Re-issue bank deeplink for a booking |
| `/api/public/shop/[shopKey]/payment/deeplink-return` | Status for bank-app return page (HMAC `?t=` only) |
| `/api/public/shop/[shopKey]/display` | Queue display data |
| `/api/public/shop/[shopKey]/me` | LIFF user profile |
| `/api/public/shop/[shopKey]/member-context` | Member context |
| `/api/line/webhook/[shopKey]` | LINE Webhook handler |

### Admin (`super_admin` only)
| Route | Resource |
|---|---|
| `/api/admin/shop-subscriptions` | Manage shop plans |
| `/api/admin/active-shop` | Acting shop for super_admin (GET list + current, POST select, DELETE clear) — stored in httpOnly cookie `portal_admin_shop_id`, applied by `requireAuthContext` |
| `/api/shop-subscription/current` | Current plan status |

---

## Coding Conventions

### API Route Pattern
```ts
// src/app/api/<resource>/route.ts
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { z } from 'zod';

const BodySchema = z.object({ ... });

export async function POST(req: Request) {
  try {
    const { supabase, profile, roles } = await requireAuthContext({
      roles: ['shop_owner', 'branch_manager'],
    });
    const body = BodySchema.parse(await req.json());
    // query with tenant scope
    const { data, error } = await supabase
      .from('table')
      .insert({ ...body, company_id: profile.company_id, shop_id: profile.shop_id });
    if (error) return Response.json({ error: error.message }, { status: 400 });
    return Response.json({ data });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: getErrorStatus(e) });
  }
}
```

### Server Component Pattern
```tsx
// src/app/portal/<page>/page.tsx
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function Page() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  // ...
}
```

### Client Component Pattern
```tsx
'use client';
// ใช้เฉพาะที่จำเป็น — useState, useEffect, event handler
```

### Confirm Dialog (portal)
ห้ามใช้ `window.confirm` / modal เขียนเองใน portal — ใช้ `useConfirm()` จาก `src/components/ui/confirm-dialog.tsx` (mount `ConfirmProvider` ไว้ใน `app/layout.tsx` แล้ว)
```ts
const confirm = useConfirm();
const ok = await confirm({
  tone: 'error',                 // error | warning | primary | info (default warning)
  title: 'ลบลูกค้านี้?',          // คำถามสั้น มีกรรม
  description: 'ประวัติการจองยังอยู่ แต่ลูกค้าจะหายจากรายชื่อ', // บอกผลที่ตามมา
  context: { primary: row.full_name, secondary: row.phone }, // ทำกับอะไร
  confirmLabel: 'ลบลูกค้า',      // กริยา+กรรม ห้าม "ตกลง/ยืนยัน/OK"
  cancelLabel: 'ไม่ยกเลิก',      // ใส่เมื่อการกระทำเองคือ "ยกเลิก"
  acknowledge: '...',            // optional checkbox ต้องติ๊กก่อน (งานย้อนกลับไม่ได้)
  onConfirm: () => api(),        // optional: dialog ถือ loading เอง, throw = toast + เปิดค้าง
});
```
`ActionIconButton` / `ActionIconGroup` รับ prop `confirm: ConfirmRequest` (prop เดิม `confirmBeforeClick/confirmTitle/confirmMessage` ยังใช้ได้ แต่ deprecated)
ฝั่ง LIFF (`src/components/line/`) เป็น Tailwind ไม่มี MUI provider — ยังใช้ `window.confirm` อยู่ ตั้งใจไว้ ทำแยก

### Import Alias
```ts
import { xxx } from '@/lib/...';      // ถูก
import { xxx } from '../../lib/...';  // ผิด
```

### Database Migration
```sql
-- supabase/migrations/YYYYMMDDNNNN_description.sql
-- ใช้ IF NOT EXISTS / IF EXISTS ทุกครั้ง
-- ห้ามแก้ไฟล์ migration เก่า
```

---

## Security Rules

- ทุก API route ต้องผ่าน `requireAuthContext` (ยกเว้น `/api/public/*` และ `/api/line/webhook/*`)
- ห้าม leak error detail ใน response body
- ต้อง verify LINE signature ใน webhook (`src/lib/line/signature.ts`)
- ห้าม query ข้าม tenant (`company_id`/`shop_id` บังคับ)
- ต้อง validate Zod schema ก่อน process ทุก route

---

## Demo Mode

- Shop มี `demo_mode_enabled = true` เมื่ออยู่ใน demo sandbox
- Demo data tagged ด้วย `is_demo = true`
- Demo banner แสดงทุก `/portal/*` เมื่อ `demo_mode_enabled`
- `convert_to_real` action จะ disable demo mode และ archive demo bookings

---

## Notification System

ใช้ `safeCreateNotification(...)` สำหรับ side-effect — ไม่ break core flow ถ้า fail

```ts
import { safeCreateNotification } from '@/lib/notifications/createNotification';
await safeCreateNotification({ shopId, type: 'booking_created', ... });
```

`safeCreateNotification` = notification center ของ **staff** เท่านั้น ไม่ถึงลูกค้า

**ลิงก์ในปุ่ม Flex / quick reply ที่ส่งหาลูกค้า** ต้องสร้างผ่าน `resolveCustomerLiffUrl` (`src/lib/line/liff-url.ts`) → `https://liff.line.me/{id}?shop_key=…&tab=account|booking` (ลำดับ ID: account = `liff_id_login_shop` → `liff_id` → env `LIFF_ID`; booking กลับกัน) — **ห้าม**ใส่ `${APP_URL}/liff/{shopKey}` ตรง ๆ เพราะ LINE เปิดใน in-app browser นอก LIFF context → `liff.isLoggedIn()` false → หน้าขึ้น "กรุณาเปิดหน้านี้ผ่าน LINE LIFF"; ร้านที่ไม่มี LIFF ID เลยจึงค่อย fallback app URL. ปุ่ม "ดูคิวของฉัน" (เรียกคิว/เตือนคิว) และ "ไม่สะดวก / ยกเลิกคิว" ใช้ `tab: 'account'`; "จองคิวใหม่" และบอทตอบ "จองคิว" ใช้ `tab: 'booking'`. Flex จองสำเร็จ ปุ่ม "ดูคิวของฉัน" ยังเป็น `message` "เช็คคิวของฉัน" (บอทตอบข้อความ) ตั้งใจคงไว้

**ลูกค้ายกเลิกคิวเองจาก LINE** — ปุ่ม "ยกเลิกคิว" บน Flex จองสำเร็จ / ร้านยืนยันคิว / เตือนคิว เป็น postback `action=cancel_booking&booking_id=` (`cancelBookingPostbackData` ใน `messages.ts`) **กดครั้งเดียวยกเลิกทันที** ไม่มี confirm → webhook เรียก `cancelBookingByCustomer` (`src/lib/booking/cancel-by-customer.ts`) ตัวเดียวกับ LIFF `/cancel-booking`: guard `CUSTOMER_CANCELLABLE_STATUSES`, ต่อท้าย `bookings.note` (ไม่ทับ), `booking_logs` `cancel_by_customer_liff|line`, แจ้ง staff `booking_cancelled` (high); Google Calendar sync อยู่ที่ caller. ตอบลูกค้าด้วย `bookingSelfCancelledFlex` ("ยกเลิกคิวแล้ว" + "จองคิวใหม่") — **ไม่ใช่** `bookingCancelledFlex` ซึ่งแปลว่าร้านยกเลิก. พิมพ์ "ยกเลิก…" (หรือกดการ์ดเก่าที่ยังเป็น `message`) → บอทตอบ `bookingCancelPromptFlex` โชว์คิวที่ใกล้สุดที่ยกเลิกได้ + ปุ่ม postback เดียว (text path ถูก gate `auto_reply_enabled`, postback ไม่). ไม่มี `bookingId` → builder fallback เป็น `message` เดิม

แจ้ง **ลูกค้า** ทาง LINE เมื่อร้านย้าย / เปลี่ยนคน / ยกเลิกคิว ใช้ `safeNotifyBookingChange` (`src/lib/line/notify-booking-change.ts`) — ไม่ throw, คิวที่ไม่มี LINE ได้ `{ sent: false }`
- `moved` / `reassigned` → Flex มีปุ่ม postback `action=ack_change` → webhook เรียก `acknowledgeBookingChange` (`src/lib/booking/acknowledge-change.ts`) และ stamp `bookings.change_acknowledged_at`
- `reassigned` ส่งเฉพาะ resource ที่เป็นคน (`isPersonResourceType`) — เปลี่ยนโต๊ะ/ห้องไม่แจ้ง
- `cancelled` ไม่ต้อง ack
- Postback events (`ack_change`, `cancel_booking`) ถูก handle **ก่อน** เช็ค `auto_reply_enabled` ใน webhook

แจ้งเตือน **ลูกค้าล่วงหน้าก่อนถึงคิว** (ค่าเริ่มต้นปิด) — ตั้งค่าที่ `/portal/line-settings` (`shops.reminder_enabled`, `shops.reminder_minutes` preset 15/30/60/120/180/1440)
- Scheduler: **Supabase pg_cron + pg_net** ทุก 5 นาที (migration `202609120005`) เรียก `GET /api/cron/booking-reminders` ด้วย `Bearer CRON_SECRET` — Vercel Hobby ยิง cron ได้แค่รายวัน จึงไม่ใช้ `vercel.json`
- ต้องมี Vault secrets `cron_app_url` + `cron_secret` ใน Supabase ก่อน job ถึงจะยิง (function `trigger_booking_reminders` return เงียบถ้าไม่มี)
- Sender: `safeNotifyBookingReminder` (`src/lib/line/notify-booking-reminder.ts`) → Flex `bookingReminderFlex`; stamp `bookings.reminder_sent_at` ส่งครั้งเดียวต่อคิว (stamp ด้วยเมื่อไม่มี LINE user / token; `push_failed` ไม่ stamp ให้รอบหน้าลองใหม่)
- คิวที่สร้างภายในช่วงเวลาเตือน (จองล่วงหน้าน้อยกว่า `reminder_minutes`) ถูก stamp โดยไม่ส่ง — Flex ยืนยันเพิ่งไปแล้ว
- Window helper: `computeReminderWindow` / `isInReminderWindow` (`src/lib/line/booking-reminder.ts`) เทียบ `booking_date`+`start_time` ใน Asia/Bangkok

---

## Reports (`/portal/reports`)

- UI ที่ `src/components/reports/` — `ReportDocument` คือตัวรายงานแบบเอกสาร (หัวรายงาน → ตัวเลขสำคัญ+เทียบช่วงก่อน → กราฟ → ตารางสรุป → รายการคิว; section บทสรุปเป็นข้อความถูกตัดออกแล้ว 2026-09-13 — `src/lib/reports/summary.ts` ยังอยู่แต่ไม่ถูกใช้) ใช้ตัวเดียวทั้งหน้าจอ (paper card) และ PDF — PDF มี section ครบและเรียงเหมือนหน้าจอ (`print` แค่ล็อก grid 2 คอลัมน์ + โชว์รายการคิวทั้งหมด); presets ใน `src/lib/reports/range-presets.ts`; `today`/`tomorrow`/`next7` = ใบรายการคิว (รายการคิวขึ้นก่อน มีช่องหมายเหตุ), `last7`/`last30`/`custom` = วิเคราะห์ย้อนหลัง
- **PDF = browser print** (`usePrintReport` + `ReportPrintSheet` portal เข้า `document.body`, CSS `body.report-printing` ใน `globals.css`) — ไม่มี PDF lib; ฟอนต์ Kanit/ภาษาไทยจึง render ตรงกับหน้าจอ ทั้ง dark mode ก็พิมพ์เป็น light เสมอ
- CSV ผ่าน `/api/reports?mode=csv&group=day|staff|bookings` (มี BOM ให้ Excel อ่านไทย)

## Resource ↔ Service Link (optional)

`booking_resources.service_ids uuid[]` — บริการที่ resource นี้ให้บริการได้ (เช่น ครูโยคะ ↔ คลาสโยคะ). `NULL`/ว่าง = ใช้ได้ทุกบริการ (พฤติกรรมเดิม)
- Helper: `src/lib/booking/resource-service-link.ts` (`resourceServesService`, `filterResourcesForService`)
- ตั้งค่าที่ `/portal/resources` (single + bulk) — API ตรวจว่า id เป็น service ของร้านนี้
- LIFF / portal create drawer / move dialog กรองตัวเลือก resource ตาม service ที่เลือก; `/api/public/shop/[shopKey]/book`, `/api/bookings` POST+PATCH ปฏิเสธ 400 ถ้า resource ไม่ให้บริการนั้น
- Migration `202609120003_resource_service_link.sql`

## Resource / Service Images (ช่วยลูกค้าจำสนาม/ห้อง)

- Columns (migration `202609210001_resource_service_images.sql` — **must run before deploy**, `/meta` selects them): `booking_resources.image_urls text[]` (≤5, first = cover), `services.image_url`, `branches.layout_image_url` (venue map)
- Flow: form uploads first via `POST /api/shop-assets/image` (`ImageUploader`, `src/components/forms/image-uploader.tsx`) → URL saved by the normal `/api/resources|services|branches` POST/PATCH. Those routes reject any URL outside the shop's own `shop-assets/<shop_id>/` prefix (`findForeignAssetUrl`) and delete detached objects best-effort (`removeDetachedShopAssets`, `src/lib/storage/shop-assets-server.ts`). PATCH only touches the image column when the key is present in the body
- Pure helpers + vitest: `src/lib/storage/shop-assets.ts` (`isOwnShopAssetUrl`, `removedAssetPaths`), `src/lib/booking/resource-history.ts` (`summarizeResourceHistory`, `sortResourcesByHistory`, `resourceHistoryBadge`)
- LIFF: `OptionCard` takes `imageUrl` / `badge` / `onPreview`; `LiffGalleryDialog` (scroll-snap, no carousel dep) shows photos + floor/zone/description, "ดูผัง" opens the branch map. Previously booked resources sort first with "จองล่าสุด / เคยจอง N ครั้ง" derived from `/me` history — no favourites table, never auto-selects. Booking cards look the photo up live by `resource_id` (no URL snapshot on `bookings`)
- `SimpleCrud` column `type: 'image'` (+ `imageKind`) = single uploaded photo; resource type `court` ("สนาม") added in `resource-types.ts` (DB column is free text)
- Images render with plain `<img>` — `next.config.ts` has no `images.remotePatterns`
- Not done: pins on the venue map, heart/favourite button, photo in LINE Flex, photos in bulk create

## Daily Booking Limit (ลูกค้าจองได้วันละ 1 คิว)

Opt-in ต่อร้าน `shops.one_booking_per_day` (default false) — switch อยู่หน้า `/portal/services` ผ่าน `PATCH /api/shop-display-settings` (ทุก key optional, เขียนเฉพาะที่ส่งมา); migration `202609220002_daily_booking_limit.sql` (**must run before deploy** — app อ่าน flag ผ่าน `isOneBookingPerDay` แบบ defensive จึงไม่พัง แต่ trigger กัน race ต้องมี)
- ขอบเขต **ทั้งร้าน** (ไม่ว่าบริการไหน) key = `bookings.customer_id`; นับทุกสถานะยกเว้น `cancelled`/`no_show` (completed ยังนับ — เหมือน slot capacity)
- บังคับ **เฉพาะลูกค้าจองเองผ่าน LIFF** — `/api/public/shop/[shopKey]/book` count ก่อน insert → 409 `{ error, code: 'daily_limit' }`; DB trigger `enforce_daily_booking_limit` (advisory lock ต่อ shop+customer+วัน) เป็น backstop กัน 2 device/double-tap, raise `daily_limit` → route map เป็น 409 เดียวกัน
- Trigger ข้ามแถวที่ `created_by is not null` (portal staff = override ได้ตั้งใจ) และ `is_demo` — `/api/bookings` POST ไม่มี check นี้
- Pure helpers + vitest: `src/lib/booking/daily-limit.ts` (`countsTowardDailyLimit`, `findSameDayBooking`, `dailyLimitMessage`, `isDailyLimitDbError`); `/meta` ส่ง `shop.one_booking_per_day` ให้ LIFF เตือนใต้วันที่ + ปิดปุ่มยืนยันจาก `[...upcoming, ...history]` (`upcoming` ไม่มี completed จึงต้องรวม history)

## Queue Number

เลขคิวออกโดย **DB trigger** `assign_queue_number` (migration `202609220001_queue_number_sequence.sql` — **must run before deploy**: app ไม่ส่ง `queue_number` ตอน insert แล้ว ถ้าไม่มี trigger จะพัง NOT NULL)
- นับต่อ `shop + branch + booking_date` ทุกสถานะ (รวมยกเลิก/ลบ/demo) → เลขไม่ถูกใช้ซ้ำในวันนั้น, reset รายวันต่อสาขา
- รูปแบบ `A001–A999 → B001 … Z999` (`format_queue_number(ordinal)`; เกิน Z999 คง `Z` เลขวิ่งต่อ) — mirror ใน TS `src/lib/booking/queue-number.ts` (`formatQueueNumber`, มี vitest) ไว้อ้างอิง ไม่ได้ใช้ออกเลขจริง
- Race: advisory lock ต่อ (shop, branch, วัน) ใน trigger + unique index `uq_bookings_queue_number_per_day` — insert ซ้ำได้ 23505; migration มี `do` block renumber เลขซ้ำเก่าก่อนสร้าง index (แถวแรกสุดคงเลขเดิม แถวหลังได้เลขว่างถัดไปของวันนั้น)
- Row ที่ส่ง `queue_number` มาเอง trigger ไม่แตะ (demo sandbox ใช้ prefix `D` ใน `src/lib/demo/sandbox.ts`)
- อ่านเลขที่ DB ออกให้ผ่าน `.select('id,queue_number')` หลัง insert (`/api/bookings`, `/api/public/shop/[shopKey]/book`)

## Booking Status Flow

```
LIFF book ─┬─ service.requires_approval / booking_mode=request_approval ─▶ pending_approval ─(staff อนุมัติ → LINE "ร้านยืนยันคิว")─▶ confirmed
           └─ otherwise ───────────────────────────────────────────────────────────────────────────────────────────────────────────▶ confirmed

confirmed ─(ลูกค้ากด "ฉันมาถึงแล้ว" ใน LIFF, เฉพาะวันจอง)─▶ checked_in
confirmed | checked_in ─(staff รอเรียก)─▶ waiting
confirmed | checked_in | waiting ─(staff เรียกคิว → LINE "ถึงคิวของคุณแล้ว")─▶ called ─(เรียกซ้ำ = called อีกครั้ง, call_count+1)
called | waiting ─(เริ่มบริการ)─▶ serving ─▶ completed
                                          ↘ cancelled / no_show
pending | pending_approval | confirmed | checked_in | waiting ─(ลูกค้ากด "ยกเลิกคิว" ใน LIFF หรือ Flex)─▶ cancelled
```

- Rules ทั้งหมดอยู่ที่ `src/lib/booking/status-flow.ts` (`resolveInitialBookingStatus`, `checkInEligibility`, `isCallTransition`, `isApprovalTransition`, `CUSTOMER_*_STATUSES`) — LIFF, public API และ portal ใช้ตัวเดียวกัน
- **เรียกคิว** = `PATCH /api/bookings { status: 'called' }` → stamp `called_at`, `called_by`, `call_count` แล้ว push `bookingCalledFlex` ผ่าน `safeNotifyBookingStatus` (`src/lib/line/notify-booking-status.ts`, ไม่ throw, stamp `last_line_notify_at`) — signage เรียงคิว "กำลังเรียก" ตาม `called_at`
- **อนุมัติ** = `pending_approval → confirmed` → push `bookingApprovedFlex`; ปฏิเสธใช้ปุ่มยกเลิกเดิม (ลูกค้าได้ Flex ยกเลิก)
- **ลูกค้ายกเลิกเอง** = `cancelBookingByCustomer` (`src/lib/booking/cancel-by-customer.ts`) ใช้ทั้ง `POST /api/public/shop/[shopKey]/cancel-booking` (LIFF) และ webhook postback `cancel_booking`; อนุญาตเฉพาะ `CUSTOMER_CANCELLABLE_STATUSES`, `called|serving` ต้องติดต่อร้าน
- **เช็คอิน** = `POST /api/public/shop/[shopKey]/check-in` → `checkInBookingByCustomer` (`src/lib/booking/check-in.ts`) stamp `bookings.checked_in_at` + แจ้ง staff ผ่าน notification center; อนุญาตเฉพาะ `pending|confirmed` และ `booking_date` = วันนี้ (Asia/Bangkok, `/me` ส่ง `today` มาให้ LIFF ใช้กฎเดียวกัน)
- ปุ่ม staff ต่อสถานะอยู่ที่ `NEXT_STATUSES` ใน `src/components/bookings/booking-types.ts`; kanban `/portal/queue-board` รวม `checked_in` ไว้คอลัมน์ "รอเรียก"
- Migration `202609130001_booking_checkin.sql` (เพิ่ม `checked_in_at`) — enum `called`/`checked_in`/`pending_approval` มีตั้งแต่ `202605110001`

## Rich Menu Builder (`/portal/rich-menu`)

เลือกประเภทธุรกิจ → master template (layout + ไอคอน + ข้อความไทย + สี) → preview → ดาวน์โหลด / บันทึกรูป / เผยแพร่ไป LINE
- Lib ทั้งหมดที่ `src/lib/line/rich-menu/` (pure, มี vitest): `business-types.ts` (`BUSINESS_TYPES` 12 ค่า, `normalizeBusinessType` map จาก registration `business_category` + `demo_business_type`), `layouts.ts` (cells integer ใน 2500-space: `hero3|grid3x2|grid2x2|grid3x1|grid2x1`), `templates.ts` (`templateForBusiness`, `refitButtonsForLayout`), `schema.ts` (`RichMenuConfigSchema` v1: label ≤20, chatBarText ≤14, buttons = จำนวน cell), `render.ts` (`renderRichMenu` วาดใน 2500-space แล้ว `scale` — preview กับ export ใช้โค้ดเดียว), `line-request.ts` (`buildRichMenuRequest` → LINE `areas` จาก cell เดียวกับภาพ, throw `RichMenuConfigError` ถ้าไม่มี LIFF ID), `line-api.ts` (create / upload content ผ่าน **api-data.line.me** / set default / delete), `canvas.ts` (browser only: `ensureFontsLoaded`, `canvasToBlobUnderCap` PNG→JPEG ถ้าเกิน 1 MB), `image-size.ts` (ตรวจขนาด PNG/JPEG ฝั่ง server)
- UI: `src/components/rich-menu/` (`RichMenuBuilder` container + pickers + `PhonePreview` + `ExportBar`); studio ไอคอนรายชิ้นเดิม (`src/components/onboarding/rich-menu-icon-studio.tsx`) ใช้ icons/colors/canvas จาก lib เดียวกัน ไม่มี sheet export แล้ว
- Publish flow: ต้อง save config → บันทึกรูปลงระบบ (`shops.rich_menu_image_url`) → publish; server อ่านรูปกลับจาก storage, ตรวจขนาดตรง layout, สร้าง menu บน LINE, ถ้า upload/set default พังจะลบ menu ที่เพิ่งสร้าง; menu เก่าของระบบถูกลบ best-effort; เก็บ `shops.line_rich_menu_id` + `rich_menu_published_at`
- Rich menu ที่สร้างผ่าน API **ไม่แสดงใน LINE OA Manager** — UI โชว์ id + วันที่ + ปุ่มยกเลิกการเผยแพร่
- `shops.business_type` ถูก set ตอน register (`normalizeBusinessType(business_category)`) และ sync จาก demo sandbox ถ้ายัง null
- Migration `202609140001_rich_menu_generator.sql` (business_type, rich_menu_config, rich_menu_image_url, line_rich_menu_id, rich_menu_published_at + backfill จาก demo_business_type)

## Payment Methods

| `payment_method` | Flow | Confirmed by |
|---|---|---|
| `omise_promptpay` | Omise QR | Omise webhook + charge re-fetch |
| `omise_mobile_banking` | Bank buttons in LIFF (`MOBILE_BANKS` in `src/lib/payments/mobile-banking/banks.ts`: kbank/scb/bay/bbl/ktb) → Omise `source[type]=mobile_banking_*` charge with `return_uri` → `authorize_uri` opens bank app, amount locked; bank in `bookings.bank_provider`, link in `bank_deeplink_url`, charge in `omise_charge_id` | `confirmOmiseCharge` (`src/lib/payments/omise-confirm.ts`) — shared by webhook, `/payment/status` polling and `/payment/deeplink-return`; re-fetches charge, checks satang, conditional `paid` update |
| `bank_transfer` | Shop PromptPay QR + slip upload | Staff approves slip |
| `bank_deeplink` | Open bank app (SCB Easy / K PLUS) via `src/lib/payments/deeplink/` adapters; bank in `bookings.bank_provider` | Bank inquiry API (`confirmDeeplinkPayment`) — never the webhook body |

### Slip auto-check (`bank_transfer`)

On upload (`/api/public/shop/[shopKey]/payment/slip`) the server runs `autoVerifySlip` (`src/lib/payments/slip/`) on the stored bytes — never throws, never fails the upload:
- `decode-image.ts` (sharp + jsQR, server-only) → `slip-qr.ts` parses the BoT slip mini-QR (EMVCo TLV: tag 00 = api id `000001` + sending bank + `transRef`, tag 51 `TH`, tag 91 CRC-16/CCITT-FALSE, reuses `crc16ccitt` from `promptpay.ts`)
- The slip QR carries **no amount / receiver / time** — those need a bank-side source. `provider.ts` is that seam (`resolveSlipProvider` returns `null` today; adapter + per-shop key via `secret-box` is a TODO — do not guess vendor field names)
- `evaluate.ts` (pure, vitest) → `auto_check_status`: `verified` (bank confirmed amount+receiver+time) | `plausible` (valid unseen QR, amount NOT confirmed) | `suspicious` (bad CRC / duplicate `transRef` / bank mismatch) | `unreadable` | `error`
- **Auto-approve only on `verified`** and not past `payment_expires_at`. Local checks alone never mark a booking paid (QR + CRC are forgeable). No auto-reject — every doubt goes to the manual queue
- Duplicate lookup is cross-tenant by design (service role, boolean only); rejected/superseded slips release their `transRef`
- `approve.ts` `approveSlip` = single approval path for staff PATCH and auto (`slip.auto_approved` event, `reviewed_by` null); unique index `uq_payment_slips_approved_trans_ref` → 409 "สลิปซ้ำ"
- Migration `202609190001_slip_auto_verify.sql` (must run before deploy — `/api/payment-slips` selects the new columns)

Bank deeplink field names are unverified against bank portals — every literal in `deeplink/scb.ts` and `deeplink/kbank.ts` is marked `VERIFY`. KBank ships disabled (`DEEPLINK_KBANK_ENABLED`). Requires `PAYMENT_LINK_SECRET`.

Omise Mobile Banking: toggle `shops.mobile_banking_enabled` (migration `202609160001`), same Omise keys as QR, needs `PAYMENT_LINK_SECRET` (return page) and https `NEXT_PUBLIC_APP_URL`. Always offers all 5 banks — a bank not activated on the shop's Omise account fails at charge creation (booking still saved, LIFF toast + "เปลี่ยนธนาคาร"). Limits 20–150,000 THB (`isMobileBankingAmountOk`; out of range → method skipped, falls through). Re-issue/switch bank = `POST /api/public/shop/[shopKey]/payment/mobile-banking` (new charge; old one lapses on Omise). Hidden on desktop like `bank_deeplink`. `BankCode` (5) ⊃ `BankProvider` (scb/kbank, direct-API only) — never widen `BankProvider`, it keys `Record`s in `deeplink/registry.ts`.

---

## Environment Variables

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Service-role client |
| `NEXT_PUBLIC_APP_URL` | ✅ | Base URL |
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE | LINE OA token |
| `LINE_CHANNEL_SECRET` | LINE | Webhook signature |
| `LIFF_ID` | LINE | LIFF App ID |
| `RESEND_API_KEY` | Email | Signup notification |
| `SMTP_*` | Email | Gmail SMTP fallback |

---

## Hard Limits — ห้ามทำเด็ดขาด

- ห้าม query ข้าม tenant โดยไม่มี `company_id`/`shop_id`
- ห้ามแก้ migration ไฟล์เก่า — ต้องสร้างไฟล์ใหม่
- ห้าม expose `SUPABASE_SERVICE_ROLE_KEY` ใน client component
- ห้าม bypass RLS โดยไม่มีเหตุผลชัดเจน
- ห้าม `createAdminClient()` ใน public routes
- ห้าม skip LINE signature verification

---

## Development Commands

```bash
npm run dev          # Start dev server (port 3000)
npm run build        # Production build
npm run typecheck    # tsc --noEmit (ต้องผ่านก่อน commit)
npm run lint         # ESLint check
npm run create:super-admin  # Create super admin user
```

---

## AI Skills อยู่ที่

- `ai/skills/engineer/SKILL.md` — Engineering patterns + quality gate
- `ai/skills/fixbug/SKILL.md` — Bug debug workflow
- `ai/skills/SKILL.md` — (ถ้ามี) project-level skill index
