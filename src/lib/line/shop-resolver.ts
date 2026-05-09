import type { SupabaseClient } from '@supabase/supabase-js';

export type ResolvedShop = {
  id: string;
  company_id: string;
  name: string;
  shop_key: string;
  liff_id: string | null;
  is_deleted: boolean;
};

function looksLikeUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

export async function resolveShopByKeyOrId(admin: SupabaseClient, shopRef: string): Promise<ResolvedShop | null> {
  const ref = shopRef.trim();
  if (!ref) return null;

  const baseSelect = 'id,company_id,name,shop_key,liff_id,is_deleted';
  const byKey = await admin.from('shops').select(baseSelect).eq('shop_key', ref).eq('is_deleted', false).maybeSingle();
  if (byKey.data) return byKey.data as ResolvedShop;

  if (looksLikeUuid(ref)) {
    const byId = await admin.from('shops').select(baseSelect).eq('id', ref).eq('is_deleted', false).maybeSingle();
    if (byId.data) return byId.data as ResolvedShop;
  }

  return null;
}
