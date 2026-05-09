import Link from 'next/link';
import Image from 'next/image';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { PortalNav } from '@/components/layout/portal-nav';
import { NotificationsMenu } from '@/components/layout/notifications-menu';
import { TopbarUserMenu } from '@/components/layout/topbar-user-menu';

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('users_profile')
    .select('full_name, shop_id, company_id')
    .eq('id', user.id)
    .maybeSingle();

  let resolvedShopId = profile?.shop_id ?? null;
  if (!resolvedShopId) {
    const { data: roleContext } = await supabase
      .from('user_roles')
      .select('shop_id')
      .eq('user_id', user.id)
      .eq('is_deleted', false)
      .not('shop_id', 'is', null)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    resolvedShopId = roleContext?.shop_id ?? null;
  }

  // Fallback: legacy owner accounts may miss profile/user_roles context.
  if (!resolvedShopId) {
    const admin = createAdminClient();
    const { data: createdShop } = await admin
      .from('shops')
      .select('id')
      .eq('created_by', user.id)
      .eq('is_deleted', false)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    resolvedShopId = createdShop?.id ?? null;
  }

  const { data: shop } = resolvedShopId
    ? await createAdminClient().from('shops').select('id,name,logo_url').eq('id', resolvedShopId).maybeSingle()
    : { data: null };

  const logoUrl = shop?.logo_url ?? null;

  const appVersion = process.env.NEXT_PUBLIC_APP_VERSION || 'v0.1.0';

  return (
    <div className="portal-shell md:grid md:grid-cols-[280px_1fr]">
      <aside className="portal-sidebar hidden md:block">
        <div className="mb-6">
          <div className="flex items-center gap-2">
            {logoUrl ? (
              <Image src={logoUrl} alt="Shop Logo" width={36} height={36} className="h-9 w-9 rounded-lg object-cover" />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-xs font-bold text-white">QB</div>
            )}
            <div>
              <p className="text-xs text-slate-400">Portal</p>
              <h2 className="font-semibold text-slate-800">Queue Booking</h2>
            </div>
          </div>
        </div>
        <PortalNav />
      </aside>
      <div>
        <header className="portal-header">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              {logoUrl ? (
                <Image src={logoUrl} alt="Shop Logo" width={28} height={28} className="h-7 w-7 rounded-md object-cover" />
              ) : (
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-900 text-[10px] font-bold text-white">QB</div>
              )}
              <div>
                <p className="text-xs text-slate-400">Shop</p>
                <p className="text-sm font-semibold text-slate-800">{shop?.name ? `${shop.name} (${shop.id})` : `Shop ID: ${resolvedShopId ?? '-'}`}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <NotificationsMenu />
              <TopbarUserMenu initialName={profile?.full_name} email={user.email} appVersion={appVersion} />
            </div>
          </div>
          <div className="overflow-x-auto border-t border-slate-200 px-2 py-2 md:hidden">
            <div className="flex gap-2 min-w-max">
              <Link className="btn-outline" href="/portal/dashboard">Dashboard</Link>
              <Link className="btn-outline" href="/portal/bookings">Bookings</Link>
              <Link className="btn-outline" href="/portal/branches">Branches</Link>
              <Link className="btn-outline" href="/portal/services">Services</Link>
              <Link className="btn-outline" href="/portal/working-hours">Working Hours</Link>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-7xl p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
