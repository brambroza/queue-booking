import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { PortalNav } from '@/components/layout/portal-nav';
import { NotificationsMenu } from '@/components/layout/notifications-menu';

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
    ? await createAdminClient().from('shops').select('id,name').eq('id', resolvedShopId).maybeSingle()
    : { data: null };

  async function signOut() {
    'use server';
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect('/login');
  }

  return (
    <div className="min-h-screen md:grid md:grid-cols-[250px_1fr]">
      <aside className="hidden border-r border-slate-200 bg-white/90 p-4 backdrop-blur md:block">
        <div className="mb-4">
          <p className="text-xs text-slate-500">Portal</p>
          <h2 className="font-semibold">Queue Booking</h2>
        </div>
        <PortalNav />
      </aside>
      <div>
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/85 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
            <div>
              <p className="text-xs text-slate-500">Shop Selector</p>
              <p className="text-sm font-medium">{shop?.name ? `${shop.name} (${shop.id})` : `Shop ID: ${resolvedShopId ?? '-'}`}</p>
            </div>
            <div className="flex items-center gap-2">
              <NotificationsMenu />
              <span className="text-sm">{profile?.full_name ?? user.email}</span>
              <form action={signOut}>
                <button className="btn-outline">Logout</button>
              </form>
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
        <main className="mx-auto max-w-7xl p-4">{children}</main>
      </div>
    </div>
  );
}
