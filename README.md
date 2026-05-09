# LINE Queue Booking SaaS Platform (Phase 1 MVP)

ระบบจองคิวแบบ SaaS สำหรับร้านค้า รองรับ multi-tenant ด้วย Supabase + Next.js (App Router)

## Tech Stack
- Next.js App Router + TypeScript
- Tailwind CSS (mobile-first)
- Supabase PostgreSQL + Supabase Auth + RLS
- API Routes for CRUD MVP

## Implemented in Phase 1
- Auth/Register/Login (Supabase Auth)
- Auto create `company` + `shop` + `shop_key` + `users_profile` + assign `shop_owner`
- Portal layout + dashboard
- Branch CRUD (create/list/delete)
- Service CRUD (create/list/delete)
- Working hours CRUD (create/list)
- Booking CRUD MVP (create/list/status update/delete)
- Available slot RPC scaffold: `get_available_slots`
- Supabase SQL schema + seed + RLS + function scripts

## Project Structure
- `src/app`: pages + API routes
- `src/components`: UI and forms
- `src/lib`: supabase/auth/booking/intent helpers
- `supabase/migrations`: schema migration
- `supabase/seed.sql`: role/permission seed
- `supabase/rls.sql`: row level security policies
- `supabase/functions.sql`: business SQL functions

## Environment
Copy `.env.example` to `.env.local` and fill values:

```bash
cp .env.example .env.local
```

Required:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL`

## Local Run
1. Install dependencies
```bash
npm install
```

2. Run SQL on Supabase (SQL Editor or CLI)
- `supabase/migrations/202605090001_init.sql`
- `supabase/functions.sql`
- `supabase/seed.sql`
- `supabase/rls.sql`

3. Start dev server
```bash
npm run dev
```

4. Open
- `http://localhost:3000/register`
- create shop owner account
- login and access `http://localhost:3000/portal/dashboard`

## Deploy Vercel
1. Push repository to GitHub
2. Import project in Vercel
3. Set env vars in Vercel Project Settings
4. Deploy

## Notes
- LINE webhook and LIFF booking full flow are placeholder in Phase 1 andจะพัฒนาต่อใน Phase 2
- For production, use encrypted secrets storage for LINE tokens and audit logging enhancement

## Implemented in Phase 2
- Public booking APIs for LIFF:
  - `GET /api/public/shop/[shopKey]/meta`
  - `GET /api/public/shop/[shopKey]/slots`
  - `POST /api/public/shop/[shopKey]/book`
- LIFF booking page (mobile-first): `/liff/[shopKey]`
  - choose branch/service/date/time
  - fill profile and confirm booking
- Rule-based Thai intent parser with date/time extraction
- LINE webhook: `POST /api/line/webhook/[shopKey]`
  - signature validation
  - save inbound messages
  - detect intent
  - reply with quick reply and booking guidance

## Implemented in Phase 3
- Chat Inbox
  - `GET/POST /api/chat-inbox`
  - view conversations and send LINE Push messages from portal
- Calendar View
  - `GET /api/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD`
  - grouped booking timeline by date
- Queue Board (Kanban)
  - use booking statuses `confirmed/waiting/serving/completed`
  - update status in board via booking API
- Reports + CSV Export
  - `GET /api/reports` for JSON summary
  - `GET /api/reports?mode=csv` for file export
- Notifications
  - `GET/POST/PATCH /api/notifications`
  - header notification menu with mark-as-read

## Production Hardening
- API RBAC guard by role in server routes (`super_admin/shop_owner/branch_manager/staff`)
  - centralized in `src/lib/auth/context.ts` via `requireAuthContext({ roles: [...] })`
- Deep pagination/filter
  - `GET /api/bookings`: `page,page_size,date,status,branch_id,service_id,q`
  - `GET /api/branches`: `page,page_size,active,q`
  - `GET /api/services`: `page,page_size,active,q`
  - `GET /api/chat-inbox`: `page,page_size,q,msg_page,msg_page_size`
  - `GET /api/calendar`: `from,to,status,branch_id,service_id`
  - `GET /api/reports`: `from,to,branch_id,service_id,mode=csv`
- Dashboard real charts
  - `GET /api/dashboard` for 14-day trend + status distribution
  - visualized in `/portal/dashboard` (line trend + status bars)
