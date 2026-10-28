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
| `/api/automation` | Customer automations: GET settings + this month's cap usage, ROI (`automation_sends` converted) and win-back preview (also creates a `quota_80` upgrade lead once/month when a Starter shop passes 80% of its booking quota); PATCH settings (win-back ON needs Professional+, 402) |
| `/api/cron/customer-automations` | pg_cron (`Bearer CRON_SECRET`): `?job=followup` every 5 min, `?job=winback` daily 10:00 Bangkok |
| `/api/notifications` | Notification center |
| `/api/chat-inbox` | LINE chat inbox + push reply |
| `/api/line-settings` | LINE OA configuration |
| `/api/customer-guide` | Data for the customer how-to image on `/portal/line-settings`: OA `basic_id` + add-friend URL (LINE `/v2/bot/info` with the shop token), saved rich menu config (or business template) + `is_saved` / `is_published`, first 3 active services, example `slot_times` from working hours, first `branch_name`, `logo_url` (https only) |
| `/api/settings` | Shop settings |
| `/api/shop-display-settings` | Customer-facing flags on `shops`: `show_service_duration`, `one_booking_per_day`, `multi_slot_enabled` (GET all, staff may read; PATCH keys optional) |
| `/api/fnb-settings` | F&B ordering switch (`shops.fnb_enabled`); turning ON needs Professional+ (`assertFnbPlan`, 402 `feature_locked`), OFF always allowed |
| `/api/fnb-menu` | F&B menu CRUD (writes plan-gated; "sold out" toggle `is_available` allowed on any plan) |
| `/api/fnb-orders` | Staff order board: GET open/all, PATCH status new→preparing→served/cancelled + LINE push to customer |
| `/api/fnb-requests` | Staff board for customer "call staff" / "check bill" requests: GET open+acknowledged, PATCH status open→acknowledged→closed (acknowledge pushes LINE to the customer) |
| `/api/shop-profile` | Shop profile |
| `/api/shop-payment-settings` | Omise + bank transfer settings |
| `/api/shop-payment-settings/deeplink` | Bank deeplink (SCB/KBank) credentials per shop + `/test` connection check |
| `/api/shop-payment-settings/slip-verify` | Slip verification vendor key per shop (GET source `shop\|platform\|none` + `plan_locked`; PATCH `enabled` / `credentials.apiKey`, sealed) + `/test` (vendor quota call, rate-limited `slipVerifyTest`) |
| `/api/cron/slip-recheck` | pg_cron every 5 min (`Bearer CRON_SECRET`): re-runs the bank-side check on pending slips with `next_recheck_at` due, auto-approves when verified |
| `/api/cron/payment-expiry` | pg_cron every 5 min (`Bearer CRON_SECRET`): cancels LIFF orders held `pending_approval` for payment once `payment_expires_at` + 5 min passed unpaid (Omise / deeplink re-checked at the provider first) |
| `/api/payments/webhook` | Omise webhook (shared secret `?key=`) |
| `/api/payments/bank/[provider]/webhook/[shopKey]` | Bank deeplink confirmation (per-shop secret `?key=`, verified by inquiry) |
| `/api/shop-showcase` | Landing-page showcase of this shop: GET consent + fields + review state (staff may read); PATCH `consent`, `show_*`, `area_label`, `quote`, `submit` (shop_owner) — writes via service role, rules in `applyOwnerPatch` |
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
| `/api/public/shop/[shopKey]/fnb/menu` | Public menu (`enabled:false` + empty when plan < Professional or switch off) |
| `/api/public/shop/[shopKey]/fnb/order` | LIFF order for an on-site booking (checked_in+, booking day only; prices always from DB) |
| `/api/public/shop/[shopKey]/fnb/my-orders` | Caller's orders for one booking (POST: identity token in body) |
| `/api/public/shop/[shopKey]/fnb/request` | LIFF "เรียกพนักงาน" / "ขอเช็คบิล" (one open request per booking+type, unique index; bill stores an estimate snapshot) |
| `/api/public/shop/[shopKey]/fnb/bill` | Read-only bill estimate for the caller's own booking (bay fee unless paid online + non-cancelled food) |
| `/api/public/shop/[shopKey]/display` | Queue display data |
| `/api/public/time` | Server clock (`{ now }`, no DB) for the LIFF release countdown |
| `/api/public/shop/[shopKey]/me` | LIFF user profile |
| `/api/public/shop/[shopKey]/member-context` | Member context |
| `/api/line/webhook/[shopKey]` | LINE Webhook handler |

### Admin (`super_admin` only)
| Route | Resource |
|---|---|
| `/api/admin/shop-subscriptions` | Manage shop plans; GET also returns `setup` (5-step progress per shop, `src/lib/onboarding/status.ts`, same rules as the dashboard checklist) and `email_log` (last onboarding email per shop) |
| `/api/admin/shop-subscriptions/send-email` | Send an onboarding email to the shop owner: `kind=setup_guide` (LINE OA setup nudge + PDF `public/docs/line-setup-guide.pdf`, source `docs/guides/line-setup-guide.html`) or `kind=go_live` (needs 5/5 steps; closes demo mode via `disableDemoMode` then sends). 409 `line_already_connected` / `recently_sent` need `force`; every send is audit-logged `onboarding_email_sent` |
| `/api/admin/active-shop` | Acting shop for super_admin (GET list + current, POST select, DELETE clear) — stored in httpOnly cookie `portal_admin_shop_id`, applied by `requireAuthContext` |
| `/api/admin/shop-showcase` | Showcase review queue (GET, with real-booking count + LINE flag) and `approve\|reject\|unpublish\|feature\|unfeature` (PATCH, reason required for reject/unpublish, notifies the shop, audit-logged) |
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
- ห้าม leak error detail ใน response body (public route: ข้อความไทยทั่วไป + `console.error` ฝั่ง server)
- ต้อง verify LINE signature ใน webhook (`src/lib/line/signature.ts`, constant-time) ด้วย secret **ของร้าน** เท่านั้น — ไม่ fallback env
- ห้าม query ข้าม tenant (`company_id`/`shop_id` บังคับ)
- ต้อง validate Zod schema ก่อน process ทุก route
- **ตัวตนลูกค้า LIFF** = `resolveLiffCaller` (`src/lib/line/liff-identity.ts`) ตรวจ LIFF ID token กับ LINE แล้วใช้ `sub` — ห้ามเชื่อ `line_user_id` ใน body ตรง ๆ. client ส่ง `id_token` (`liff.getIDToken()`) ทุก call. prod บังคับเสมอ (`LIFF_ID_TOKEN_REQUIRED=false` = ทางหนีชั่วคราวเท่านั้น)
- route public ใหม่ต้องมี `hitRateLimit` (`src/lib/security/rate-limit.ts`, ตาราง `rate_limits`)
- ข้อความค้นหาที่ใส่ใน `.or()` / `.ilike()` ต้องผ่าน `escapePostgrestSearch` / `escapeLike` (`src/lib/utils/postgrest.ts`)
- secret ไม่ส่งกลับ client เต็ม ๆ (mask 4 ตัวท้าย); Omise key เก็บแบบ sealed (`sealOmiseSecretKey`)
- ลิงก์ชำระเงิน public ต้องมี HMAC `t` (`signBookingToken`); prod ไม่มี `PAYMENT_LINK_SECRET` = 404 ทุกลิงก์; Omise webhook prod ต้องมี `OMISE_WEBHOOK_SECRET`
- `users_profile.shop_id/company_id` และ `user_roles` เขียนได้เฉพาะ service role (migration `202610020002`); `requireAuthContext` ไม่ให้ role จาก `users_profile.shop_id` อีกแล้ว
- CSV export ต้องกัน formula injection (`csvEscape` ใน `/api/reports`); HTML email ต้อง `escapeHtml`

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

## Customer Guide Image (`/portal/line-settings`, 2026-10-28)

`CustomerGuideCard` (`src/components/line-settings/customer-guide-card.tsx`) draws **one** 1080×1920 PNG of this shop's booking flow for the shop to post on Facebook or send in LINE — 5 rows, text left + mock screen right: 1) scan the OA add-friend QR (`https://line.me/R/ti/p/%40{basicId}`) + id, 2) the shop's saved rich menu (`renderRichMenu`) with the booking button ringed + "แตะ", 3) up to 3 real active services (name, duration, price; first selected), 4) date strip (next 5 days from today, Bangkok) + 6 time chips from the shop's first active `working_hours` row (one picked, one "เต็ม"), 5) the **real** booking-confirmed Flex — `exampleConfirmBubble` calls `bookingConfirmFlex` (queue A001, first branch, picks from steps 3–4) and `src/lib/line/flex-canvas.ts` paints it on a LINE chat background (subset renderer: bubble header/body/footer, box, text, button, separator; LINE px sizes — a likeness, not LINE's renderer; a builder change shows up automatically). Step 4 hint says dates are examples. Theme color = rich menu color unless the shop picks a preset / custom color; logo = none, the shop's `logo_url` (needs CORS on storage, else disabled) or a local file (PNG/JPG/WebP ≤5 MB, never uploaded) — shown in the header and as the chat avatar; color/logo changes redraw live. Drawn in the browser only — nothing stored, no migration
- Data `GET /api/customer-guide` (`services`, `slot_times`, `basic_id`, `add_friend_url`, rich menu config or business template + `is_saved` / `is_published`); card reloads after a passing "ทดสอบการเชื่อมต่อ" (`refreshKey`). No basic id (no/bad token) = button disabled with the reason; no rich menu / not published / no services = warning, image still drawn with fallbacks
- Pure rules + vitest: `src/lib/line/customer-guide.ts` (`normalizeBasicId`, `lineAddFriendUrl`, `bookingButtonIndex`, `serviceSubtitle`, `sampleSlotTimes`, `guideFileName`, `isHexColor`, `exampleDays`, `exampleConfirmBubble`), `flex-canvas.ts` (`flexTextSize`, `flexSpace`, `flexBubbleWidth`); painter `customer-guide-render.ts` (browser only, `loadGuideAssets`, `drawGuideImage`)
- Share = `navigator.share` with the PNG (mobile share sheet → LINE / Facebook), falls back to download
- Not done: saving the chosen color/logo, per-branch QR / hours (uses the first working-hours row of any branch), real LIFF screenshots

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

## Slot Capacity (จำนวนคิวต่อรอบ)

ตั้งค่า **ที่เดียว** = `services.capacity_per_slot` (หน้า `/portal/services` ช่อง "จำนวนคิวต่อรอบ"). `working_hours.capacity_per_slot` และ `branches.max_parallel_queues` เป็น **deprecated** — column ยังอยู่ แต่ไม่มีโค้ดอ่าน และถอดออกจากฟอร์มแล้ว (schema เป็น optional, insert ใช้ DB default 1, update ไม่แตะค่าเดิม)
- กฎ: นับต่อ `shop + branch + service + booking_date + start_time`, ทุกสถานะยกเว้น `cancelled`/`no_show`, เต็มเมื่อ `count >= capacity_per_slot` — ตรงกับ `get_slot_availability` / `get_available_slots`
- นับ **แยกต่อบริการ**: 2 บริการใน slot เดียวกันมี capacity ของตัวเอง — ร้านที่ช่างคนเดียวทำหลายบริการต้องใช้ resource กันซ้อน
- คิวที่มี `resource_id` **ข้าม** กฎนี้ — `is_resource_available` คุมแทน
- Migration `202609290001_slot_capacity_guard.sql` (**run before deploy** — ไม่รันก็ไม่พัง แต่ race ยังเปิด): trigger `enforce_slot_capacity` (before insert, advisory lock ต่อ slot) raise `slot_full`; ข้ามแถว `created_by is not null` (staff), `is_demo`, `resource_id is not null`. Trigger ไม่คุม update
- Helpers + vitest: `src/lib/booking/slot-capacity.ts` (`countSlotBookings`, `isSlotFull`, `occupiesSlot`, `slotFullMessage`, `slotFullStaffMessage`, `isSlotFullDbError`, `SLOT_FULL_CODE`)
- ลูกค้า: `/api/public/shop/[shopKey]/book` count ก่อน insert → 409 `{ error, code: 'slot_full' }`; LIFF โหลด slot ใหม่
- Staff: `/api/bookings` POST + PATCH (ย้ายคิว) คืน 409 `slot_full` ครั้งแรก → portal ถาม `useConfirm` ("จองเกินรอบนี้") → ส่งซ้ำพร้อม `allow_overbook: true` (จองเกินได้ตั้งใจ)
- Dashboard: `CapacityModel` รับ `perSlotSeats` = `seatsPerSlot(services)` (ผลรวม `capacity_per_slot` ของบริการ active) — เป็นค่าประมาณ, บริการที่ผูก resource capacity จริงคือจำนวน resource

## Multi-slot Booking + ต่อเวลา (2026-10-14)

ความยาวคิว = `end_time - start_time` อย่างเดียว ไม่มี column ความยาว
- **LIFF เลือกหลายช่อง = หลายคิว (2026-10-14, แทนการแตะขยายช่วงต่อเนื่อง)**: เปิด switch ร้านอย่างเดียว ใช้ได้ทุกบริการ ไม่ต้องตั้ง `flexible_duration` / ไม่ต้องมี resource. ลูกค้าแตะช่องที่ว่างกี่ช่องก็ได้ (ไม่ต้องติดกัน) สูงสุด `MAX_SLOTS_PER_ORDER` = 4, แตะซ้ำ = เอาออก (`toggleSlotPick`); ปิดเมื่อร้านเปิด `one_booking_per_day` (server ตอบ 409 `daily_limit`). LIFF ส่ง `start_times[]` → `/book` ตรวจ**ทุกช่องก่อนเขียน** (past, resource/capacity ผ่าน `planSlot` ตัวเดียวกับคิวเดี่ยว), resource เดียวกันต้องห่าง ≥ ความยาวบริการ (`picksOverlap`, 400 `multi_pick_invalid`), insert ทีละคิว — ถ้าคิวไหนพัง (trigger race) คิวที่เขียนไปแล้วของ order นั้นถูก `cancelled` + `is_deleted`. คิวแรก (เวลาเร็วสุด) ถือ payment ยอดรวม × จำนวนคิว; คิวอื่นไม่มี payment และมี `note` "จองพร้อมคิว X (ชำระรวมที่คิวนั้น)". Flex ยืนยันส่ง 1 การ์ดต่อคิว (ปุ่มยกเลิกแยก), notification staff 1 รายการ, quota นับครบทุกคิว. Response มี `bookings[]`. ข้อจำกัด: ยกเลิกคิวแรกไม่ได้ย้าย/คืนเงินให้คิวอื่น, ไม่มี column group
- `slot_count` (คิวเดียวยาวหลายรอบ, `flexible_duration` + resource) ยังมีใน `/book` และ portal create drawer แต่ LIFF ไม่ส่งแล้ว; ส่ง `slot_count > 1` พร้อม `start_times` หลายค่า = 400
- **Switch ทั้งร้าน `shops.multi_slot_enabled` (default ปิด)** ที่หน้า `/portal/services` ผ่าน `PATCH /api/shop-display-settings { multi_slot_enabled }` (GET อ่านได้ถึง role `staff`); migration `202610140001_multi_slot_toggle.sql` (**run before deploy** — อ่านผ่าน `isMultiSlotEnabled` แบบ defensive: ยังไม่รัน = ฟีเจอร์ปิด แต่กด switch จะ error). ปิด = LIFF ไม่โชว์ stepper, `/book` + `/api/bookings` POST ปฏิเสธ `slot_count > 1`, PATCH `end_time` (ต่อเวลา) 400, portal ซ่อนปุ่มต่อเวลา + ช่องจำนวนรอบ
- Opt-in ต่อบริการ: `services.booking_mode = 'flexible_duration'` (column เดิมจาก `202605100002`); 1 รอบ = `duration_minutes`, จองได้ถึง `floor(max_duration_minutes / duration)` รอบ (cap 24), ถ้าเกิน 1 รอบต้อง ≥ `min_duration_minutes`
- **เฉพาะคิวที่ผูก resource** (สนาม/ห้อง/ครู/โต๊ะ auto-assign) — resource guard เช็คแบบช่วงเวลาจึงกันรอบถัดไปให้เอง; ไม่มี resource + `slot_count > 1` = 400 `multi_slot_needs_resource` (slot capacity ปกตินับ start_time ตรงตัว จะไม่กันรอบหลัง)
- (เดิม) LIFF แตะขยายช่วงต่อเนื่อง (`nextSlotSelection`) — เลิกใช้ใน LIFF แล้ว helper ยังอยู่; `/book` ตรวจทุกรอบด้วย `get_slot_availability` ของ resource นั้น (ในเวลาทำการ ไม่ทับพัก ไม่ผ่านแล้ว) → 409 `multi_slot_unavailable` + `is_resource_available` ช่วงเต็ม; ราคา = ราคาต่อรอบ × `slot_count`; Flex/ข้อความเวลาเป็น `HH:MM–HH:MM`
- Portal สร้างคิว: select จำนวนรอบใน `BookingCreateDrawer` (`/api/bookings` POST `slot_count`, ไม่ตรวจเวลาทำการ — staff override)
- **ต่อเวลา (staff เท่านั้น)**: `PATCH /api/bookings { id, end_time }` — คิวต้องมี `resource_id`, สถานะ `EXTENDABLE_STATUSES`, end ใหม่ > เดิม, วันเดียวกัน, `is_resource_available` (exclude ตัวเอง) ไม่ว่าง = 409; log + notification `booking_updated`; **ไม่ส่ง LINE ลูกค้า**, ไม่สร้าง payment เพิ่ม (เก็บเงินส่วนต่อที่หน้าร้าน). UI = ปุ่ม `+30 นาที` / `+1 รอบ` ใน `BookingEditDrawer` ผ่าน `useConfirm`
- ย้ายคิว (PATCH move) คงความยาวเดิมของคิว (`bookingDurationMinutes`) ไม่รีเซ็ตเป็น duration ของบริการแล้ว
- `end_time` ใน `/book` และ `/api/bookings` POST คำนวณด้วย string (`bookingEndTime`) ไม่ใช้ `Date#getHours()` ที่อ่าน timezone ของ server
- Pure helpers + vitest: `src/lib/booking/multi-slot.ts` (`maxSlotCount`, `minSlotCount`, `isSlotCountAllowed`, `bookingEndTime`, `consecutiveSlotsOpen`, `maxOpenSlotCount`, `nextSlotSelection`, `selectedSlotTimes`, `bookingDurationMinutes`, `isExtendableStatus`)
- Not done: ลูกค้าต่อเวลาเองใน LIFF, จ่ายเงินส่วนต่อออนไลน์, multi-slot สำหรับบริการไม่ผูก resource, chatbot ยังจองได้ทีละรอบ

## Daily Booking Limit (ลูกค้าจองได้วันละ 1 คิว)

Opt-in ต่อร้าน `shops.one_booking_per_day` (default false) — switch อยู่หน้า `/portal/services` ผ่าน `PATCH /api/shop-display-settings` (ทุก key optional, เขียนเฉพาะที่ส่งมา); migration `202609220002_daily_booking_limit.sql` (**must run before deploy** — app อ่าน flag ผ่าน `isOneBookingPerDay` แบบ defensive จึงไม่พัง แต่ trigger กัน race ต้องมี)
- ขอบเขต **ทั้งร้าน** (ไม่ว่าบริการไหน) key = `bookings.customer_id`; นับทุกสถานะยกเว้น `cancelled`/`no_show` (completed ยังนับ — เหมือน slot capacity)
- บังคับ **เฉพาะลูกค้าจองเองผ่าน LIFF** — `/api/public/shop/[shopKey]/book` count ก่อน insert → 409 `{ error, code: 'daily_limit' }`; DB trigger `enforce_daily_booking_limit` (advisory lock ต่อ shop+customer+วัน) เป็น backstop กัน 2 device/double-tap, raise `daily_limit` → route map เป็น 409 เดียวกัน
- Trigger ข้ามแถวที่ `created_by is not null` (portal staff = override ได้ตั้งใจ) และ `is_demo` — `/api/bookings` POST ไม่มี check นี้
- Pure helpers + vitest: `src/lib/booking/daily-limit.ts` (`countsTowardDailyLimit`, `findSameDayBooking`, `dailyLimitMessage`, `isDailyLimitDbError`); `/meta` ส่ง `shop.one_booking_per_day` ให้ LIFF เตือนใต้วันที่ + ปิดปุ่มยืนยันจาก `[...upcoming, ...history]` (`upcoming` ไม่มี completed จึงต้องรวม history)

## Advance Booking Window (จำกัดระยะจองล่วงหน้า)

Opt-in **ต่อสาขา** ตั้งที่ฟอร์ม `/portal/branches`; migration `202609290002_branch_booking_window.sql` (**must run before deploy** — flow จองอ่านผ่าน helper แบบ defensive จึงไม่พัง แต่บันทึกสาขาจาก portal จะ error เพราะฟอร์มส่ง 2 column นี้)
- `branches.booking_advance_window` = ระยะเลื่อนตามวัน รหัส `<จำนวน><d|w|m>` เช่น `1w`, `1m`, `3m` (CHECK constraint); เดือนนับ **ตามปฏิทิน** (29/09 + 1 เดือน = 29/10, 31/01 + 1 เดือน = วันสุดท้ายของ ก.พ.) ไม่ใช่ 30 วัน
- `branches.booking_open_until` = วันสุดท้ายที่จองได้แบบตายตัว
- ตั้งทั้งคู่ = ใช้วันที่ถึงก่อน; `NULL` ทั้งคู่ = ไม่จำกัด (พฤติกรรมเดิม); วันสุดท้าย **จองได้** (inclusive)
- บังคับ **ทั้งลูกค้าและ staff** (ไม่มี override ต่างจาก slot capacity / daily limit): `/api/public/shop/[shopKey]/book`, `/api/bookings` POST และ PATCH (เฉพาะเมื่อย้าย **วัน** — เปลี่ยนเวลา/คนในวันเดิมไม่ตรวจ) คืน 400 `{ error, code: 'beyond_booking_window' }`. ไม่มี DB trigger (ไม่มี race ให้กัน)
- `/slots` คืน `meta.reason: 'beyond_window'` + `meta.max_date` และข้าม slot lookup; `/meta` ส่ง `branches[].max_booking_date` (คำนวณฝั่ง server ด้วยวัน Bangkok) ให้ LIFF ตั้ง `max` ของช่องวันที่ก่อนโหลด slot ครั้งแรก
- Pure helpers + vitest: `src/lib/booking/booking-window.ts` (`resolveMaxBookingDate`, `advanceWindowEnd`, `addCalendarMonths`, `isBeyondBookingWindow`, `bookingWindowMessage`, `getBranchBookingWindow`, `getShopBookingWindows`, `ADVANCE_WINDOW_OPTIONS`)
- `SimpleCrud` column `type: 'select'` (+ `options`) และ `optional: true` (ไม่บังคับกรอก) เพิ่มมาพร้อมฟีเจอร์นี้
- Portal: `BookingCreateDrawer` ตั้ง `max` ช่องวันที่ตามสาขาที่เลือก; `BookingMoveDialog` (รับ prop `branches`) ขึ้น error + ปิดปุ่มเมื่อย้ายไปวันที่เกิน — คำนวณจาก `/api/branches` (`select *`) ด้วย `resolveMaxBookingDate`
- Chatbot (`ask_available_slots`) ตอบ `bookingWindowMessage` แทนรายการเวลาเมื่อวันที่ถามเกิน window; `/api/available-slots` คืน `data: []` + `meta.reason: 'beyond_window'`
- Not done: ยังไม่มี integration test ของ route; ยังไม่ได้ทดสอบกับสาขาที่ตั้ง window จริง (ทุกสาขาใน DB ยังเป็น NULL)

### เปิดจองตั้งแต่วันที่ (2026-10-16)

`branches.booking_open_from` (migration `202610160001_branch_booking_open_from.sql`, **must run before deploy** — ฟอร์มสาขาส่ง column นี้) = **วันแรกที่จองได้** (ขอบล่างของ `booking_date`) คู่กับ `booking_open_until` เป็นช่วงตายตัว เช่น ร้าน SHOP-PDCLSQ "เปิดจอง 23–25" = ลูกค้าจองได้ตั้งแต่วันนี้ แต่เลือกได้แค่ 23, 24, 25. `NULL` = ตั้งแต่วันนี้. DB CHECK + zod refine: `booking_open_from <= booking_open_until`. (เคยลองความหมายแบบ "วันที่เริ่มรับจอง / pre-sale" แล้ว user ยกตัวอย่างชัดว่าต้องการขอบล่าง จึงเปลี่ยนในวันเดียวกัน)
- Helper: `resolveMinBookingDate(today, settings)` คืน from เฉพาะเมื่อ > วันนี้ (ไม่งั้น null — กฎวันผ่านแล้วคุมเอง), `isBeforeBookingWindow`, `bookingWindowStartMessage(min, max?)` ("เปิดจองเฉพาะวันที่ 23 ต.ค. ถึง 25 ต.ค. 2569" / "เปิดจองตั้งแต่วันที่ …"); ใช้ code เดิม `beyond_booking_window`
- บังคับทั้งลูกค้าและ staff เหมือน window เดิม: `/api/public/shop/[shopKey]/book`, `/api/bookings` POST และ PATCH (เฉพาะย้าย**วัน**) 400; `/slots` + `/api/available-slots` คืน `data: []` + `meta.reason: 'before_window'` + `meta.min_date`; chatbot ตอบข้อความช่วง; `/meta` ส่ง `branches[].min_booking_date`; `/bookable-days` ส่ง `min_date` (holiday query เริ่มที่ min)
- LIFF: `BookableDayRules.minDate` — ปฏิทินไม่โชว์วันก่อน from, `firstBookableDay` / `bookableMonths` เริ่มจาก from; caption ใต้ปฏิทิน "เปิดจองวันที่ A ถึง B"; fallback native input ตั้ง `min`
- Portal: `BookingCreateDrawer` ตั้ง `min` ช่องวันที่ + helper text ช่วง; `BookingMoveDialog` error + ปิดปุ่มเมื่อย้ายไปวันก่อน from
- Not done: ยังไม่ได้ทดสอบกับสาขาจริง (SHOP-PDCLSQ ยังไม่ได้ตั้งค่าใน DB)

## LIFF ปฏิทินแสดงเฉพาะวันที่จองได้ (2026-09-29)

ลูกค้า **ไม่เห็นวัน** ที่จองไม่ได้ — กันลูกค้างง. **ช่วงเวลา** ยังแสดงครบแบบ disabled เหมือนเดิม
- **วัน**: ช่องวันที่ native ถูกแทนด้วย `LiffDateCalendar` (`src/components/line/liff-date-calendar.tsx`, ปฏิทินรายเดือน อาทิตย์ขึ้นก่อน). วันที่ผ่านแล้ว / เกิน booking window / weekday ที่ไม่มี `working_hours` active / วันหยุด = ช่องว่าง; เดือนที่ไม่มีวันจองได้เลยถูกข้าม. สาขาไม่จำกัดระยะ = เลื่อนได้ 12 เดือน (`UNLIMITED_HORIZON_MONTHS`) — เป็นขีดของ **ปฏิทิน** เท่านั้น server ไม่ได้บังคับ
- กฎมาจาก `GET /api/public/shop/[shopKey]/bookable-days?branch_id=` → `{ today, max_date, open_weekdays, holidays }` (scope `branch_id` หรือ null เหมือน `/slots`); โหลดใหม่ทุกครั้งที่เปลี่ยนสาขา แล้วเลื่อน `date` ไปวันแรกที่จองได้ถ้าวันเดิมไม่อยู่ในปฏิทิน. โหลดไม่สำเร็จ → fallback เป็นช่องวันที่ native (server ยังตรวจ)
- **เวลา**: ไม่เปลี่ยน — grid วาดทุก slot, เต็ม = สีเทา "เต็ม N/N", ผ่านแล้ว = เส้นประ, กดไม่ได้. เคยลองซ่อน slot ที่จองไม่ได้แล้ว user ให้กลับเป็น disabled (2026-09-29) อย่าซ่อนอีก
- วันที่ **คิวเต็มทั้งวัน** ยังแสดงในปฏิทิน (ปฏิทินไม่รู้ occupancy)
- Pure helpers + vitest: `src/lib/booking/bookable-days.ts` (`isDayBookable`, `firstBookableDay`, `bookableMonths`, `buildMonthGrid`, `calendarEndDate`, `formatThaiMonthTitle`)
## Booking Rush Protection (2026-10-22)

เหตุ: ร้านประกาศเปิดจอง 19:00 ลูกค้ารีเฟรช LIFF รัว ~1M request → Supabase ล่ม (1 refresh เคย = ~23 Supabase calls, 2 writes)
- **Cache** `src/lib/cache/kv.ts` `cached(key, { ttlSeconds }, loader)`: memory ต่อ instance → Upstash Redis REST (optional, `UPSTASH_REDIS_REST_URL/TOKEN`, ไม่มี dependency ใช้ `fetch`) → loader; coalesce miss พร้อมกันเป็น loader เดียว, loader พัง = เสิร์ฟค่าเก่า (stale), Redis timeout 150ms + circuit breaker 30s — **Redis ล่มต้องไม่ทำให้ request พัง**. loader ต้อง throw เมื่อ query error (ห้าม cache ค่าว่างจาก error). `invalidateCache([...])` รับ prefix `*` (memory เท่านั้น)
- Keys: `shop:{shopKey}` 60s (`resolveShopCached`), `meta:{shopId}` 30s, `bookable-days:{shop}:{branch}` 60s, `slots:{shop}:{branch}:{service}:{date}:…` 3s (ลบ prefix หลัง `/book` สำเร็จ), `release:{shopId}` 15s, `liff-channels:{shopId}` 60s, `liffsub:{shop}:{sha256(token)}` ≤600s/≤token exp. `/api/branches` POST/PATCH ลบ `release`/`meta`/`bookable-days`; settings อื่นรอ TTL (≤ ~45s รวม CDN)
- **CDN**: `/meta`, `/bookable-days`, `/slots` ส่ง `Cache-Control: s-maxage` (`src/lib/cache/http.ts`) — ห้ามใส่ข้อมูลรายลูกค้าใน response เหล่านี้
- **Rate limit** `src/lib/security/rate-limit.ts`: Redis (fixed window) → memory เมื่อ Redis error (**ไม่ตก DB**); ไม่ตั้ง Redis = limit เดิมยังใช้ RPC `hit_rate_limit`, limit `noDb` (`liffRead`, `liffIp`) ใช้ memory. `/me` + `/book` key ด้วย `liffSubject` (hash ของ id_token) + `liffIp` 600/min กัน CGNAT มือถือ 429 ปลอม. 429 มี `code: rate_limited`, `retry_after`
- `/me` view mode อ่าน `line_users` ก่อน เขียนเฉพาะเมื่อ display name/รูปเปลี่ยน
- **`/book` guards** `src/lib/security/request-guard.ts`: `acquireSeat('book:{shop}', 20)` เกิน = 503 `code: busy`; `idempotency_key` (client ส่งต่อการกด 1 ครั้ง) → `pending` = 409 `busy`, สำเร็จแล้ว = replay response เดิม 10 นาที; Google Calendar sync ย้ายไป `after()`
- **ห้องรอ** `branches.booking_release_at timestamptz` (migration `202610220001`, **run before deploy** — ฟอร์มสาขาส่ง column นี้; flow จองอ่านแบบ defensive): ฟอร์ม `/portal/branches` ช่อง `type: 'datetime'` (SimpleCrud ใหม่, เวลาไทยเสมอ `bangkokLocalToIso`). ก่อนเวลา: LIFF โชว์นับถอยหลัง (offset จาก `/api/public/time`), ไม่โหลด slot/ไม่ให้จอง, ถึงเวลาสุ่มรอ 0–5s (`releaseJitterMs`) ก่อนโหลด; `/slots` + `/book` ตอบ 400 `code: not_released`. `/me` ยังโหลดตามปกติ. Helpers + vitest: `src/lib/booking/booking-release.ts`
- LIFF client: `fetchJsonWithBusyRetry` (`src/lib/line/liff-fetch.ts`) retry 429/5xx/network เอง (backoff ×2 cap 15s + jitter) พร้อมข้อความ "ไม่ต้องรีเฟรช"; `/book` network error ไม่ค้าง loading แล้ว
- เลขคิว: migration `202610220002_queue_number_counter.sql` เปลี่ยน `assign_queue_number` จาก `count(*)` ทั้งวันเป็น counter row `queue_counters` (UPDATE … RETURNING), seed จากจำนวนแถวเดิมของวัน — format/unique index เดิม; รันตอน live ได้
- Load test: `scripts/load/liff-rush.k6.js` (staging เท่านั้น)
- Not done: sessionStorage cache ฝั่ง LIFF, รวม query `shops` ใน `/meta` (cache แทนแล้ว), `payment/status` polling ยังไม่ผ่าน cache, invalidate meta จาก settings/services routes

## Customer Automations (2026-10-23, rule-based, no LLM)

Two LINE automations that bring customers back, both **default off**, set at `/portal/line-settings#automation` (`AutomationSettingsCard`) via `/api/automation`. Migrations `202610230001_customer_automations.sql` + `202610230002_customer_automations_cron.sql` (**run before use** — app reads the columns defensively: not run = automations off, settings save returns 400)
- **Follow-up (all plans)**: after a queue becomes `completed` (`bookings.completed_at` stamped by DB trigger `stamp_booking_completed_at`, every path) + `shops.followup_delay_minutes` → `followupThanksFlex` (review button when `shops.google_review_url` https, "จองครั้งถัดไป" LIFF booking tab). Claimed via `bookings.followup_sent_at` (one per booking, also unique index); a failed push is recorded and **not retried**; older than delay + 24 h = skipped. Old completed rows (NULL `completed_at`) never get one
- **Win-back (Professional+, `planAllowsWinback`)**: daily; per customer the median gap between completed visits (≥2 visits, else `shops.winback_default_days`), clamped 7–120 days, + grace max(3, 25%). Skip: has an upcoming queue, last visit > 180 days, any win-back attempt in 30 days, no LINE user. Longest overdue first. Rules in `src/lib/automation/visit-interval.ts` (`decideWinback`); history loader `customer-history.ts` (paged, tenant + `is_demo=false`)
- **Cap**: both share `shops.automation_monthly_cap` (default 300), Starter ceiling 100 (`effectiveAutomationCap`), counted from `automation_sends` `status=sent` since Bangkok month start — every push spends the shop's own LINE OA quota. Unknown usage = send nothing
- **ROI**: `/book` `after()` → `safeRecordAutomationConversion` credits the latest unconverted send to the same customer within 14 days (`pickAttributableSend`), `revenue_estimate` = service price × queues. Estimate, labelled "≈" in UI
- **Upsell**: dashboard `AutomationRoiCard` shows ROI, or for Starter the real overdue count + baht as a locked card → `openUpgrade('automation')`; `/api/automation` GET creates a `quota_80` `upgrade_requests` lead once per month at ≥80% of the monthly booking quota
- Senders `src/lib/line/notify-automation.ts` (`safeSendFollowup`, `safeSendWinback`, never throw, record every attempt); Flex in `messages-automation.ts`; vitest in `src/lib/automation/automation-rules.test.ts` + `src/lib/line/notify-automation.test.ts`
- Not done: `ref` param on the LIFF link (attribution is time-window only), customers page "เลยกำหนด" badge, weekly owner digest, RFM segments, no-show risk → deposit, waitlist. Untested against a real LINE OA

## Shop Showcase บนหน้าแรก (2026-10-27)

ร้านยินยอม (PDPA แยกจาก terms, ไม่ติ๊กไว้ก่อน) ให้แสดงชื่อ/โลโก้/ประเภท/พื้นที่/คำรีวิว/ปุ่มจองบน `/` — ช่องที่ `/register` และการ์ด `ShowcaseSettingsCard` ที่ `/portal/settings#showcase`; super_admin ตรวจที่ `/portal/shop-showcase`
- Migration `202610270001_shop_showcase.sql` (**run before use** — app อ่านแบบ defensive: ไม่รัน = หน้าแรกไม่มี section, การ์ดขึ้น "ยังไม่พร้อม", สมัครไม่พัง). `shop_showcase` RLS select-only (`can_access_shop`) — **เขียนผ่าน service role เท่านั้น** กันร้านตั้ง published เอง; `shop_showcase_events` = หลักฐาน consent/revoke/review (append-only)
- สถานะ `draft → pending → approved | rejected`, ถอน = `revoked`. หน้าแรกแสดงเมื่อ `consent && published_at` และใช้ `published_quote` (snapshot ตอนอนุมัติ) — แก้คำรีวิวหลังอนุมัติต้องส่งตรวจใหม่ ระหว่างนั้นข้อความเดิมยังแสดง; reject ของการส่งซ้ำคงของเดิม, `unpublish` เอาออก. ถอนความยินยอม = ล้าง snapshot + featured ทันที
- Rules + vitest: `src/lib/showcase/showcase-rules.ts` (`applyOwnerPatch`, `applyAdminAction`, `toPublicShowcaseCard` กรองช่องที่ร้านปิดฝั่ง server, logo https เท่านั้น, ลิงก์จองผ่าน `resolveCustomerLiffUrl` tab booking); server `showcase-server.ts` (`loadPublicShowcase` cache `showcase:public` 60s, error = `[]`; `invalidatePublicShowcase` ลบ cache + `revalidatePath('/')`). `/` เป็น `revalidate = 300`
- Landing: `ShopShowcaseSection` (`landing-shop-showcase.tsx`) แถบโลโก้ทุกร้าน + การ์ดรีวิว ≤6 (featured ก่อน) — ไม่มีร้าน = ไม่ render เลย, ห้ามใส่ข้อมูลตัวอย่าง. `testimonials` ตัวอย่างเดิมใน `content.ts` ถูกลบแล้ว
- เกณฑ์ช่วยตรวจ (ไม่บังคับ): เชื่อม LINE, คิวจริง ≥ 20, ไม่อยู่ demo mode (`showcaseEligibility`); ร้าน demo mode ถูกกรองออกจากหน้าแรกเสมอ
- Banner ชวนร้านเดิม `ShowcasePromptBanner` (ใน `portal-frame`, ใต้ demo banner) ขึ้นครั้งเดียวต่อร้าน: เฉพาะ `shop_owner` (ไม่ใช่ super_admin), ไม่ใช่ demo mode, ยังไม่ยินยอม/ไม่เคยถอน และ `shop_showcase.prompt_dismissed_at` ว่าง (`shouldShowShowcasePrompt`). กด "ดูรายละเอียด" หรือ "ไม่สนใจ" / ✕ = `PATCH /api/shop-showcase { dismiss_prompt: true }` เก็บใน DB ไม่ใช่ localStorage
- `SHOWCASE_CONSENT_VERSION` ต้อง bump เมื่อแก้ข้อความยินยอม (ตอนนี้แค่บันทึก ไม่บังคับยืนยันใหม่)
- Not done: สิ่งจูงใจ (ส่วนลด/โควตา — รอ management), กรองตามประเภทในหน้า use case, หน้า `/en`, public API route, บังคับยืนยันใหม่เมื่อ version เปลี่ยน

## Queue Number

เลขคิวออกโดย **DB trigger** `assign_queue_number` (migration `202609220001_queue_number_sequence.sql` — **must run before deploy**: app ไม่ส่ง `queue_number` ตอน insert แล้ว ถ้าไม่มี trigger จะพัง NOT NULL)
- นับต่อ `shop + branch + booking_date` ทุกสถานะ (รวมยกเลิก/ลบ/demo) → เลขไม่ถูกใช้ซ้ำในวันนั้น, reset รายวันต่อสาขา
- รูปแบบ `A001–A999 → B001 … Z999` (`format_queue_number(ordinal)`; เกิน Z999 คง `Z` เลขวิ่งต่อ) — mirror ใน TS `src/lib/booking/queue-number.ts` (`formatQueueNumber`, มี vitest) ไว้อ้างอิง ไม่ได้ใช้ออกเลขจริง
- Race: advisory lock ต่อ (shop, branch, วัน) ใน trigger + unique index `uq_bookings_queue_number_per_day` — insert ซ้ำได้ 23505; migration มี `do` block renumber เลขซ้ำเก่าก่อนสร้าง index (แถวแรกสุดคงเลขเดิม แถวหลังได้เลขว่างถัดไปของวันนั้น)
- Row ที่ส่ง `queue_number` มาเอง trigger ไม่แตะ (demo sandbox ใช้ prefix `D` ใน `src/lib/demo/sandbox.ts`)
- อ่านเลขที่ DB ออกให้ผ่าน `.select('id,queue_number')` หลัง insert (`/api/bookings`, `/api/public/shop/[shopKey]/book`)

## Signage Scene Templates (`/display/[shopKey]`)

Six illustrated 2D templates next to the original five: `lane` (queue as people walking to a service point), `timeline` (one row per court / room, free stretches shown), `route` (queue as stops on a line), `floor` (every service point, dashed route to the called one), `invite` (shop-front poster with a large QR when nobody is waiting), `flap` (split-flap board)
- Migration `202609280001_signage_scene_templates.sql` (**must run before a shop can save** a new template or `day_*` theme — `signage_settings` has CHECK constraints on both; `?template=&theme=` on the display URL works without it). Keep the lists equal to `SIGNAGE_TEMPLATES` / `SIGNAGE_THEMES` in `src/lib/signage/types.ts`
- Feed: `SignageData` gained `resources` (all active `booking_resources` of the scope) and `schedule` (every booking of the day incl. served, by start time); `SignagePerson` gained `end_time`. Built in `buildSignageData`; both `/api/public/shop/[shopKey]/display` and `/api/queue-display` load resources (a failed lookup is logged, never fatal). A queue is tied to its service point by **name** (`bookings.resource_name`)
- Pure rules + vitest: `src/lib/signage/scene.ts` (`buildTimeline`, `buildStations`, `diffScene`, `minutesUntil`, `isIdle`, `bangkokMinutes`). "Now" is always Bangkok time, never the TV's clock
- UI: `src/components/signage/scenes/` — `scenes.module.css` is written in `em` (scene root sets `font-size: var(--sg-unit)`, ×1.7778 in portrait so the board is 56.25em × 100em), `scene-parts.tsx` (`SceneShell`, `HeroPanel`, `PosterQr`), `scene-art.ts` (fixed SVG markup, artwork chosen by **theme** because the feed carries no business type)
- Motion = GSAP, loaded on demand in `use-scene-motion.ts`. Resting positions are plain CSS; GSAP only plays the way there (`useMoveTo` is a hand-rolled FLIP), so the board is correct without it. Off in `thumbnail` mode and under `prefers-reduced-motion`. Movement is read from the difference between two polls (`refresh_seconds`), not pushed in real time
- Themes: palettes gained `highlight` / `highlightContrast` / `deep`; eight flat light themes `day_navy|teal|brick|chili|indigo|court|rose|lime`
- Known limits: `floor` is an automatic grid, **not** a real floor plan (no positions are stored); `timeline` gaps are gaps between bookings, not checked against working hours; `route` counts down to the appointment time, it is not a wait estimate; `invite` shows no free slots (not in the feed) and needs `show_qr` + a LIFF id for its QR; a called queue with no `resource_name` has no figure in `lane` / `floor`

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
- Lib ทั้งหมดที่ `src/lib/line/rich-menu/` (pure, มี vitest): `business-types.ts` (`BUSINESS_TYPES` 21 ค่า — 2026-10-27 เพิ่ม spa, sports_court, outdoor, pet, beauty_clinic, car_care, photo_studio, tutoring, event; หน้าสมัครส่ง key เหล่านี้ตรง ๆ และ `service_templates` ของ 9 ประเภทนี้อยู่ใน migration `202610270002_more_business_templates.sql` (ไม่รัน = ร้านใหม่ได้ "บริการทั่วไป" 1 รายการ ไม่พัง), `normalizeBusinessType` map จาก registration `business_category` + `demo_business_type`), `layouts.ts` (cells integer ใน 2500-space: `hero3|grid3x2|grid2x2|grid3x1|grid2x1`), `templates.ts` (`templateForBusiness`, `refitButtonsForLayout`), `schema.ts` (`RichMenuConfigSchema` v1: label ≤20, chatBarText ≤14, buttons = จำนวน cell), `render.ts` (`renderRichMenu` วาดใน 2500-space แล้ว `scale` — preview กับ export ใช้โค้ดเดียว), `line-request.ts` (`buildRichMenuRequest` → LINE `areas` จาก cell เดียวกับภาพ, throw `RichMenuConfigError` ถ้าไม่มี LIFF ID), `line-api.ts` (create / upload content ผ่าน **api-data.line.me** / set default / delete), `canvas.ts` (browser only: `ensureFontsLoaded`, `canvasToBlobUnderCap` PNG→JPEG ถ้าเกิน 1 MB), `image-size.ts` (ตรวจขนาด PNG/JPEG ฝั่ง server)
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

**Payment Flex buttons** ("อัปโหลดสลิป", "อัปโหลดสลิปใหม่", "ดูคิวของฉัน" on QR/deeplink cards) link via `resolveCustomerLiffUrl({ tab: 'account', bookingId })` → `…&booking_id=`. After `/me` loads, the LIFF client opens that queue's payment panel when `pickLinkedPaymentTarget` (`src/lib/line/liff-payment-link.ts`) finds it among the caller's own upcoming queues and it still owes a slip / bank-app payment; otherwise the queue list shows. `/liff/[shopKey]?tab=account` (old raw links) redirects to `/member`, keeping `booking_id`; outside LIFF the page hands over to `liff.line.me` once per session.

### Payment hold + auto-expiry (2026-10-25)

Applies only when a LIFF booking gets an online invoice with a deadline (`resolvePaymentForBooking` returned `expiresAt`). Shops without a payment method, staff-created bookings (`/api/bookings`) and services that already need approval keep the old flow
- `/book` runs payment setup **before** the staff notice and LINE confirm, then `holdBookingsForPayment`: every queue of the order `confirmed` → `pending_approval` + `bookings.payment_hold_booking_id` = the paying (first) booking. Response `awaiting_payment: true`; Flex/LIFF say "รอชำระเงิน"
- Paid (`confirmOmiseCharge`, `confirmDeeplinkPayment`, `approveSlip`) → `releasePaymentHold` before the receipt: held queues → `confirmed`. A queue the cron already cancelled is **not** revived — staff get `payment_after_expiry` (refund / rebook by hand)
- `/api/cron/payment-expiry` (migration `202610250002_payment_hold_expiry.sql`, **run before deploy** for the hold to exist; without it the app keeps the old behaviour): unpaid = `pending_payment|failed|rejected` (slip in review `awaiting_verification` never cancelled), grace `PAYMENT_EXPIRY_GRACE_MINUTES` = 5, provider error = retry next tick. Cancel → note marker, `booking_logs` `cancel_payment_expired`, staff notification, customer `bookingPaymentExpiredFlex`, Google Calendar sync. `payment_status` is left as is; hold id kept on cancelled rows
- Staff can still press "อนุมัติ" on a held queue (cash at the counter) → `confirmed`, cron skips it
- Rules + vitest: `src/lib/payments/payment-hold.ts` (`shouldHoldForPayment`, `isPaymentHoldExpired`, `isAwaitingPayment`); server side `payment-hold-server.ts`
- Not done: per-shop switch (always on when the shop takes online payment), siblings of a multi-pick stay held if staff approve only the paying queue, `/me` does not read the hold column (LIFF infers from status pair)

### Slip auto-check (`bank_transfer`)

On upload (`/api/public/shop/[shopKey]/payment/slip`) the server runs `autoVerifySlip` (`src/lib/payments/slip/`) on the stored bytes — never throws, never fails the upload:
- `decode-image.ts` (sharp + jsQR, server-only) → `slip-qr.ts` parses the BoT slip mini-QR (EMVCo TLV: tag 00 = api id `000001` + sending bank + `transRef`, tag 51 `TH`, tag 91 CRC-16/CCITT-FALSE, reuses `crc16ccitt` from `promptpay.ts`)
- The slip QR carries **no amount / receiver / time** — those need a bank-side source. `provider.ts` is that seam: `resolveSlipProvider` → `providers/settings.ts` picks the key (**shop's own key** in `shop_slip_verify_providers`, any plan → **platform key** `EASYSLIP_API_KEY` for Professional+ (`planAllowsSlipVerify`) → none) and binds the adapter from `providers/registry.ts`. `evaluate.ts` / `approve.ts` never import an adapter
- Adapters: `providers/easyslip.ts` (EasySlip API v2, `POST /verify/bank` with `{ payload, checkDuplicate: false }`, `GET /info` for the test button — the only file with vendor field names, `VERIFY` markers on the PromptPay proxy shape). Only the decoded QR payload is sent, never the image. `checkDuplicate` stays off: the cross-tenant DB check is the authority and the vendor flag would false-positive on every recheck. Kill switch `SLIP_VERIFY_EASYSLIP_ENABLED` stops both key sources. Adding a vendor = new adapter + registry entry + widen the table CHECK; a direct bank adapter (KBank/SCB) slots in the same way once GoAlong signs with a bank
- `SlipProviderResult.pending` (bank still posting, e.g. Bangkok Bank) → `bank_found` warn, status `plausible`, **never** `suspicious`. Receiver match accepts `receiverAccount` **or** `receiverProxy` (PromptPay transfers report the shop's phone/tax id as a proxy). Vendor `duplicate: true` → `verified` but `autoApprove: false` (`bank_duplicate` warn)
- Recheck: `verifySlipPayload` (shared by upload and cron, uses stored `qr_payload`) sets `payment_slips.provider_recheck_count` / `next_recheck_at` from `recheck.ts` (`shouldRecheck`, backoff 5/10/15/30/60 min, max 5; retried: vendor down, quota out, `pending`, plus one grace look for a bank "not found" on attempt 0). Cron route approves via the same `approveSlip`; `uploadedAt` = original `created_at` so the "late" rule is not judged by cron time. Demo bookings skip the vendor
- `quota_exceeded` / `invalid_api_key` → staff notification `slip_provider_problem` once per shop per Bangkok day (`notify-provider.ts`, deduped by querying `notifications`); invalid key is not retried
- Portal: card `slip-verify-card.tsx` on `/portal/payment-settings#slip-verify`; inbox shows provider + source, bank-confirmed amount/sender/receiver/time, recheck schedule, and a setup/upgrade hint when `meta.slip_verify.source === 'none'`
- Migrations `202610090001_slip_verify_provider.sql` (table + `payment_slips.provider_recheck_count/next_recheck_at` — **must run before deploy**, approve/reject/GET write or select them) and `202610090002_slip_recheck_cron.sql` (pg_cron job `slip-recheck`, same Vault secrets as booking reminders)
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
| `SLIP_VERIFY_PROVIDER` / `EASYSLIP_API_KEY` | Slip | Platform slip-verification key (Professional+); shops may use their own instead |
| `SLIP_VERIFY_EASYSLIP_ENABLED` | Slip | Kill switch for the EasySlip adapter (default on) |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Rush | Optional shared cache + rate limit + booking guards (memory-only without) |

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
