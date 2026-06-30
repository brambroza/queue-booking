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
| `/api/reports` | JSON summary / CSV export |
| `/api/notifications` | Notification center |
| `/api/chat-inbox` | LINE chat inbox + push reply |
| `/api/line-settings` | LINE OA configuration |
| `/api/settings` | Shop settings |
| `/api/shop-profile` | Shop profile |
| `/api/me-profile` | Current user profile |
| `/api/available-slots` | Slot availability check |
| `/api/service-templates` | Service templates |
| `/api/demo-sandbox` | Demo mode management |
| `/api/i18n/*` | i18n translations management |

### Public (ไม่ต้องมี auth)
| Route | Resource |
|---|---|
| `/api/public/shop/[shopKey]/meta` | Shop metadata for LIFF |
| `/api/public/shop/[shopKey]/slots` | Available slots |
| `/api/public/shop/[shopKey]/book` | Create booking (LIFF) |
| `/api/public/shop/[shopKey]/cancel-booking` | Cancel booking |
| `/api/public/shop/[shopKey]/display` | Queue display data |
| `/api/public/shop/[shopKey]/me` | LIFF user profile |
| `/api/public/shop/[shopKey]/member-context` | Member context |
| `/api/line/webhook/[shopKey]` | LINE Webhook handler |

### Admin (`super_admin` only)
| Route | Resource |
|---|---|
| `/api/admin/shop-subscriptions` | Manage shop plans |
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

---

## Booking Status Flow

```
pending → confirmed → waiting → serving → completed
                    ↘ cancelled / no_show
```

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
