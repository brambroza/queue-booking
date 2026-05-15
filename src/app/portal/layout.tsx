import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { PortalFrame } from '@/components/layout/portal-frame';

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
    ? await createAdminClient().from('shops').select('id,name,logo_url,demo_mode_enabled').eq('id', resolvedShopId).maybeSingle()
    : { data: null };

  const logoUrl = shop?.logo_url ?? null;
  const { data: roleRows } = await supabase
    .from('user_roles')
    .select('roles(code)')
    .eq('user_id', user.id)
    .eq('is_deleted', false);
  const isSuperAdmin = (roleRows ?? []).some((r) => (r.roles as { code?: string } | null)?.code === 'super_admin');

  const appVersion = process.env.NEXT_PUBLIC_APP_VERSION || 'v0.1.0';

  return (
    <PortalFrame
      logoUrl={logoUrl}
      shopName={shop?.name}
      shopId={resolvedShopId}
      fullName={profile?.full_name}
      email={user.email}
      appVersion={appVersion}
      isSuperAdmin={isSuperAdmin}
      demoModeEnabled={Boolean(shop?.demo_mode_enabled)}
    >
      {children}
    </PortalFrame>
  );
}
