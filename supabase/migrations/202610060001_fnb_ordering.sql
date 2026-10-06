-- F&B ordering from the bay / table over LINE (Phase B of the golf-simulator plan).
--
-- A shop with a menu lets a checked-in customer order food and drinks from the
-- LIFF page; staff see the order on a board (new → preparing → served) and the
-- customer gets a LINE message. No stock, no tax invoice — this is an order
-- ticket tied to a booking, not a POS.
--
-- Switch: `shops.fnb_enabled` (default off). The app only honours it on the
-- Professional plan and above; a lapsed plan hides the feature without
-- touching this column, so renewing brings it back as the owner left it.
--
-- Tenant rules: every table carries company_id + shop_id. Portal reads/writes
-- go through the API with the session client (RLS via can_access_shop). The
-- public LIFF routes use the service-role client and always filter by the shop
-- resolved from the shop key and by the verified LINE user.
--
-- Prices are snapshotted onto the order lines so later menu edits never change
-- an order that was already placed.
--
-- Run BEFORE deploying the matching app version. Idempotent.

alter table public.shops
  add column if not exists fnb_enabled boolean not null default false;

comment on column public.shops.fnb_enabled is
  'Owner switch for ordering food/drinks from a booking over LINE. Only effective on Professional plan and above (enforced in the app).';

-- ── 1. Menu ─────────────────────────────────────────────────────────────────

create table if not exists public.fnb_menu_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  shop_id uuid not null references public.shops(id),
  -- NULL = sold at every branch of the shop.
  branch_id uuid references public.branches(id),
  category text not null default 'ทั่วไป' check (char_length(category) between 1 and 60),
  item_name text not null check (char_length(item_name) between 1 and 120),
  description text check (description is null or char_length(description) <= 500),
  price numeric(10,2) not null check (price >= 0),
  image_url text,
  -- false = shown as "sold out" so the customer cannot order it today.
  is_available boolean not null default true,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  is_deleted boolean not null default false
);

create index if not exists idx_fnb_menu_items_shop
  on public.fnb_menu_items(shop_id, category, sort_order)
  where is_deleted = false;

-- ── 2. Orders ───────────────────────────────────────────────────────────────

create table if not exists public.fnb_orders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  shop_id uuid not null references public.shops(id),
  branch_id uuid references public.branches(id),
  booking_id uuid not null references public.bookings(id),
  -- Copied from the booking so the board can say "Bay 3" without a join.
  resource_id uuid references public.booking_resources(id),
  line_user_id uuid references public.line_users(id),
  status text not null default 'new'
    check (status in ('new', 'preparing', 'served', 'cancelled')),
  total_amount numeric(10,2) not null default 0 check (total_amount >= 0),
  note text check (note is null or char_length(note) <= 300),
  served_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  is_deleted boolean not null default false
);

create index if not exists idx_fnb_orders_board
  on public.fnb_orders(shop_id, status, created_at desc)
  where is_deleted = false;
create index if not exists idx_fnb_orders_booking
  on public.fnb_orders(booking_id)
  where is_deleted = false;

create table if not exists public.fnb_order_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  shop_id uuid not null references public.shops(id),
  order_id uuid not null references public.fnb_orders(id) on delete cascade,
  menu_item_id uuid references public.fnb_menu_items(id),
  -- Snapshots: the order must read the same after the menu changes.
  item_name text not null,
  unit_price numeric(10,2) not null check (unit_price >= 0),
  quantity int not null check (quantity between 1 and 99),
  note text check (note is null or char_length(note) <= 200),
  created_at timestamptz not null default now()
);

create index if not exists idx_fnb_order_items_order on public.fnb_order_items(order_id);

-- ── 3. RLS ──────────────────────────────────────────────────────────────────

alter table public.fnb_menu_items enable row level security;
alter table public.fnb_orders enable row level security;
alter table public.fnb_order_items enable row level security;

drop policy if exists fnb_menu_items_shop_all on public.fnb_menu_items;
create policy fnb_menu_items_shop_all on public.fnb_menu_items
for all to authenticated
using (public.can_access_shop(shop_id))
with check (public.can_access_shop(shop_id));

drop policy if exists fnb_orders_shop_all on public.fnb_orders;
create policy fnb_orders_shop_all on public.fnb_orders
for all to authenticated
using (public.can_access_shop(shop_id))
with check (public.can_access_shop(shop_id));

drop policy if exists fnb_order_items_shop_all on public.fnb_order_items;
create policy fnb_order_items_shop_all on public.fnb_order_items
for all to authenticated
using (public.can_access_shop(shop_id))
with check (public.can_access_shop(shop_id));
