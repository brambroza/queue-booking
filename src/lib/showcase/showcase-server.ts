import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';
import { cached, invalidateCache } from '@/lib/cache/kv';
import { createAdminClient } from '@/lib/supabase/admin';
import { env } from '@/lib/utils/env';
import {
  SHOWCASE_CACHE_KEY,
  emptyShowcaseRow,
  sortShowcaseCards,
  toPublicShowcaseCard,
  type PublicShowcaseCard,
  type ShowcaseEventAction,
  type ShowcaseRow,
  type ShowcaseShopFields,
} from './showcase-rules';

export const SHOWCASE_COLUMNS =
  'shop_id,company_id,consent,consent_version,consented_at,show_logo,show_business_type,show_area,show_booking_link,area_label,quote,status,published_quote,published_at,featured,submitted_at,reviewed_by,reviewed_at,reject_reason,prompt_dismissed_at';

/** Migration 202610270001 has not run: the table is missing. */
export class ShowcaseNotMigratedError extends Error {
  constructor() {
    super('shop_showcase table missing (migration 202610270001)');
    this.name = 'ShowcaseNotMigratedError';
  }
}

/** PostgREST / Postgres error for a table that does not exist. */
export function isMissingTableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { code?: string; message?: string };
  if (e.code === '42P01' || e.code === 'PGRST205') return true;
  return typeof e.message === 'string' && /relation .* does not exist|could not find the table/i.test(e.message);
}

/**
 * The shop's showcase row, or a fresh draft when it has none yet.
 *
 * @throws ShowcaseNotMigratedError when the table is missing.
 */
export async function loadShowcaseRow(admin: SupabaseClient, shopId: string, companyId: string): Promise<ShowcaseRow> {
  const { data, error } = await admin.from('shop_showcase').select(SHOWCASE_COLUMNS).eq('shop_id', shopId).maybeSingle();
  if (error) {
    if (isMissingTableError(error)) throw new ShowcaseNotMigratedError();
    throw error;
  }
  return (data as ShowcaseRow | null) ?? emptyShowcaseRow(shopId, companyId);
}

/** Upsert the whole row (the rules functions always return a complete row). */
export async function saveShowcaseRow(admin: SupabaseClient, row: ShowcaseRow): Promise<void> {
  const { error } = await admin
    .from('shop_showcase')
    .upsert({ ...row, updated_at: new Date().toISOString() }, { onConflict: 'shop_id' });
  if (error) {
    if (isMissingTableError(error)) throw new ShowcaseNotMigratedError();
    throw error;
  }
}

/** Append evidence rows. Failure is logged, never thrown: the change itself is already saved. */
export async function logShowcaseEvents(
  admin: SupabaseClient,
  row: Pick<ShowcaseRow, 'shop_id' | 'company_id' | 'consent_version'>,
  actions: ShowcaseEventAction[],
  actorId: string | null,
  detail: Record<string, unknown> = {}
): Promise<void> {
  if (actions.length === 0) return;
  const { error } = await admin.from('shop_showcase_events').insert(
    actions.map((action) => ({
      shop_id: row.shop_id,
      company_id: row.company_id,
      actor_id: actorId,
      action,
      consent_version: row.consent_version,
      detail,
    }))
  );
  if (error) console.error('[showcase] event log failed', error.message);
}

type PublishedRow = ShowcaseRow & {
  shops: (ShowcaseShopFields & { demo_mode_enabled: boolean | null; is_deleted: boolean }) | null;
};

/** Read every published shop straight from the DB (no cache). Throws on query error. */
async function queryPublishedShowcase(): Promise<PublicShowcaseCard[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('shop_showcase')
    .select(`${SHOWCASE_COLUMNS},shops!inner(id,name,shop_key,logo_url,business_type,liff_id,liff_id_login_shop,demo_mode_enabled,is_deleted)`)
    .eq('consent', true)
    .not('published_at', 'is', null)
    .eq('shops.is_deleted', false)
    .order('published_at', { ascending: true })
    .limit(60);
  if (error) {
    if (isMissingTableError(error)) return [];
    throw error;
  }
  const cards = ((data ?? []) as unknown as PublishedRow[])
    .filter((row) => row.shops && !row.shops.demo_mode_enabled)
    .map((row) => toPublicShowcaseCard(row, row.shops as ShowcaseShopFields, env.appUrl || null));
  return sortShowcaseCards(cards);
}

/**
 * Published shops for the landing page. Cached 60 s; any failure (env missing
 * at build time, DB down) returns an empty list so the section simply hides.
 */
export async function loadPublicShowcase(): Promise<PublicShowcaseCard[]> {
  try {
    return await cached(SHOWCASE_CACHE_KEY, { ttlSeconds: 60 }, queryPublishedShowcase);
  } catch (error) {
    console.error('[showcase] public load failed', error instanceof Error ? error.message : error);
    return [];
  }
}

/** Call after any change that can alter what the landing page shows. */
export async function invalidatePublicShowcase(): Promise<void> {
  await invalidateCache([SHOWCASE_CACHE_KEY]);
  try {
    revalidatePath('/');
  } catch (error) {
    console.error('[showcase] revalidate failed', error instanceof Error ? error.message : error);
  }
}
