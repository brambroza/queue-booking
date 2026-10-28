import { NextResponse } from 'next/server';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import type { SupabaseClient } from '@supabase/supabase-js';
import { GUIDE_SERVICES_MAX, lineAddFriendUrl, normalizeBasicId, sampleSlotTimes, type GuideService } from '@/lib/line/customer-guide';
import { loadRichMenuShop, parseStoredConfig } from '@/lib/line/rich-menu/shop-state';
import { normalizeBusinessType } from '@/lib/line/rich-menu/business-types';
import { templateForBusiness } from '@/lib/line/rich-menu/templates';

type BotInfo = { basicId: string | null; displayName: string | null; error: string | null };

/** Read the OA's basic id with the shop's own token; never throws. */
async function fetchBotInfo(token: string | null): Promise<BotInfo> {
  if (!token) return { basicId: null, displayName: null, error: 'ยังไม่ได้ใส่ Channel Access Token' };
  try {
    const res = await fetch('https://api.line.me/v2/bot/info', {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (res.status === 401) return { basicId: null, displayName: null, error: 'Token ไม่ถูกต้องหรือหมดอายุ' };
    if (!res.ok) return { basicId: null, displayName: null, error: `LINE ตอบกลับสถานะ ${res.status}` };
    const info = (await res.json()) as { basicId?: string; displayName?: string };
    return { basicId: normalizeBasicId(info.basicId), displayName: info.displayName ?? null, error: null };
  } catch {
    return { basicId: null, displayName: null, error: 'เชื่อมต่อ LINE API ไม่ได้' };
  }
}

type ServiceRow = { service_name: string | null; duration_minutes: number | null; price: number | string | null };
type HoursRow = { open_time: string; close_time: string; slot_interval_minutes: number | null; break_start: string | null; break_end: string | null };

/** First active services of the shop (oldest first = usually the main ones). A failed read shows a generic row. */
async function loadGuideServices(supabase: SupabaseClient, shopId: string): Promise<GuideService[]> {
  const { data, error } = await supabase
    .from('services')
    .select('service_name,duration_minutes,price')
    .eq('shop_id', shopId)
    .eq('active', true)
    .eq('is_deleted', false)
    .order('created_at', { ascending: true })
    .limit(GUIDE_SERVICES_MAX);
  if (error) {
    console.error('[customer-guide] services', error.message);
    return [];
  }
  return ((data ?? []) as ServiceRow[])
    .filter((r) => r.service_name)
    .map((r) => ({
      name: String(r.service_name),
      durationMinutes: r.duration_minutes ?? null,
      price: r.price === null || r.price === undefined ? null : Number(r.price),
    }));
}

/** Example times from one active working day of the shop. */
async function loadGuideSlotTimes(supabase: SupabaseClient, shopId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('working_hours')
    .select('open_time,close_time,slot_interval_minutes,break_start,break_end')
    .eq('shop_id', shopId)
    .eq('active', true)
    .eq('is_deleted', false)
    .order('weekday', { ascending: true })
    .limit(1);
  if (error) console.error('[customer-guide] working_hours', error.message);
  return sampleSlotTimes(((data ?? []) as HoursRow[])[0] ?? null);
}

/** Name of the shop's first branch, printed on the example confirmation like the real one. */
async function loadGuideBranchName(supabase: SupabaseClient, shopId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('branches')
    .select('branch_name')
    .eq('shop_id', shopId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: true })
    .limit(1);
  if (error) console.error('[customer-guide] branches', error.message);
  return ((data ?? []) as Array<{ branch_name: string | null }>)[0]?.branch_name ?? null;
}

/** Shop logo URL; read on its own so a missing column never blanks the card. */
async function loadGuideLogoUrl(supabase: SupabaseClient, shopId: string): Promise<string | null> {
  const { data, error } = await supabase.from('shops').select('logo_url').eq('id', shopId).maybeSingle<{ logo_url: string | null }>();
  if (error) console.error('[customer-guide] logo_url', error.message);
  const url = data?.logo_url ?? null;
  return url && url.startsWith('https://') ? url : null;
}

/**
 * Data for the customer how-to image: the OA add-friend link (for the QR)
 * and the rich menu the shop set up. Token never leaves the server.
 */
export async function GET() {
  try {
    const { supabase, profile } = await requireAuthContext({ roles: ['super_admin', 'shop_owner', 'branch_manager'] });
    const shop = await loadRichMenuShop(supabase, profile.shop_id as string);
    const shopId = profile.shop_id as string;
    const [bot, services, slotTimes, branchName, logoUrl] = await Promise.all([
      fetchBotInfo(shop.line_channel_access_token),
      loadGuideServices(supabase, shopId),
      loadGuideSlotTimes(supabase, shopId),
      loadGuideBranchName(supabase, shopId),
      loadGuideLogoUrl(supabase, shopId),
    ]);
    const saved = parseStoredConfig(shop.rich_menu_config);

    return NextResponse.json({
      data: {
        shop_name: shop.name,
        shop_key: shop.shop_key,
        line_name: bot.displayName,
        basic_id: bot.basicId,
        add_friend_url: lineAddFriendUrl(bot.basicId),
        line_error: bot.error,
        services,
        slot_times: slotTimes,
        branch_name: branchName,
        logo_url: logoUrl,
        rich_menu: {
          config: saved ?? templateForBusiness(normalizeBusinessType(shop.business_type)),
          is_saved: Boolean(saved),
          is_published: Boolean(shop.line_rich_menu_id),
        },
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
