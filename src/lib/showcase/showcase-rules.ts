import { BUSINESS_TYPE_LABELS, isBusinessType } from '@/lib/line/rich-menu/business-types';
import { resolveCustomerLiffUrl } from '@/lib/line/liff-url';

/**
 * Version of the consent text the shop agreed to. Bump it whenever the wording
 * on the register form or the settings card changes, so the event log records
 * which text each shop saw.
 */
export const SHOWCASE_CONSENT_VERSION = '2026-10';
export const SHOWCASE_QUOTE_MAX = 140;
export const SHOWCASE_AREA_MAX = 40;
/** Advisory bar for the admin review list; not enforced. */
export const SHOWCASE_MIN_REAL_BOOKINGS = 20;
/** Review cards shown on the landing page (the logo strip shows everyone). */
export const SHOWCASE_MAX_QUOTE_CARDS = 6;
export const SHOWCASE_CACHE_KEY = 'showcase:public';

export type ShowcaseStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'revoked';
export type ShowcaseEventAction =
  | 'consent'
  | 'revoke'
  | 'update'
  | 'submit'
  | 'approve'
  | 'reject'
  | 'unpublish'
  | 'feature'
  | 'unfeature';

export type ShowcaseRow = {
  shop_id: string;
  company_id: string;
  consent: boolean;
  consent_version: string | null;
  consented_at: string | null;
  show_logo: boolean;
  show_business_type: boolean;
  show_area: boolean;
  show_booking_link: boolean;
  area_label: string | null;
  quote: string | null;
  status: ShowcaseStatus;
  published_quote: string | null;
  published_at: string | null;
  featured: boolean;
  submitted_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  reject_reason: string | null;
  prompt_dismissed_at: string | null;
};

export type ShowcaseOwnerPatch = {
  consent?: boolean;
  show_logo?: boolean;
  show_business_type?: boolean;
  show_area?: boolean;
  show_booking_link?: boolean;
  area_label?: string | null;
  quote?: string | null;
  submit?: boolean;
};

export type ShowcaseAdminAction = 'approve' | 'reject' | 'unpublish' | 'feature' | 'unfeature';

export type ShowcaseRuleCode = 'consent_required' | 'nothing_to_review' | 'not_pending' | 'not_published';

/** A request the current state does not allow; routes map it to 409 with `code`. */
export class ShowcaseRuleError extends Error {
  constructor(public readonly code: ShowcaseRuleCode, message: string) {
    super(message);
    this.name = 'ShowcaseRuleError';
  }
}

/** Row for a shop that has never touched the showcase. */
export function emptyShowcaseRow(shopId: string, companyId: string): ShowcaseRow {
  return {
    shop_id: shopId,
    company_id: companyId,
    consent: false,
    consent_version: null,
    consented_at: null,
    show_logo: true,
    show_business_type: true,
    show_area: true,
    show_booking_link: true,
    area_label: null,
    quote: null,
    status: 'draft',
    published_quote: null,
    published_at: null,
    featured: false,
    submitted_at: null,
    reviewed_by: null,
    reviewed_at: null,
    reject_reason: null,
    prompt_dismissed_at: null,
  };
}

/** Shown on the landing page: consent still given and a reviewed snapshot exists. */
export function isShowcasePublished(row: Pick<ShowcaseRow, 'consent' | 'published_at'>): boolean {
  return row.consent && Boolean(row.published_at);
}

/**
 * One-time portal banner for owners who have never made a choice: no consent
 * yet, never withdrew, never dismissed it. Demo shops are skipped (they are
 * filtered off the landing page anyway).
 */
export function shouldShowShowcasePrompt(
  row: Pick<ShowcaseRow, 'consent' | 'status' | 'prompt_dismissed_at'>,
  input: { isOwner: boolean; demoMode: boolean }
): boolean {
  if (!input.isOwner || input.demoMode) return false;
  return !row.consent && row.status === 'draft' && !row.prompt_dismissed_at;
}

/** The owner changed the quote after it went live and has not sent it for review yet. */
export function hasUnreviewedEdit(row: Pick<ShowcaseRow, 'status' | 'quote' | 'published_quote' | 'published_at'>): boolean {
  return row.status === 'approved' && Boolean(row.published_at) && (row.quote ?? '') !== (row.published_quote ?? '');
}

/** Trim and collapse whitespace; empty becomes null. */
function cleanText(value: string | null | undefined): string | null {
  const text = (value ?? '').replace(/\s+/g, ' ').trim();
  return text ? text : null;
}

const DISPLAY_FLAGS = ['show_logo', 'show_business_type', 'show_area', 'show_booking_link'] as const;

/**
 * Apply a shop owner's change. Withdrawing consent always wins and clears the
 * published snapshot in the same write; every other field needs consent.
 *
 * @returns The next row and the events to log, in order.
 * @throws ShowcaseRuleError when the change is not allowed in the current state.
 */
export function applyOwnerPatch(
  current: ShowcaseRow,
  patch: ShowcaseOwnerPatch,
  now: Date = new Date()
): { next: ShowcaseRow; events: ShowcaseEventAction[] } {
  const iso = now.toISOString();
  const events: ShowcaseEventAction[] = [];
  const next: ShowcaseRow = { ...current };

  if (patch.consent === false) {
    if (current.consent) events.push('revoke');
    return {
      next: { ...next, consent: false, status: 'revoked', published_quote: null, published_at: null, featured: false, submitted_at: null },
      events,
    };
  }

  if (patch.consent === true && !current.consent) {
    next.consent = true;
    next.consent_version = SHOWCASE_CONSENT_VERSION;
    next.consented_at = iso;
    next.status = 'draft';
    next.reject_reason = null;
    events.push('consent');
  }

  const touchesFields =
    DISPLAY_FLAGS.some((k) => patch[k] !== undefined) || patch.area_label !== undefined || patch.quote !== undefined || patch.submit;
  if (touchesFields && !next.consent) {
    throw new ShowcaseRuleError('consent_required', 'เปิดความยินยอมให้แสดงร้านก่อน');
  }

  let changed = false;
  for (const key of DISPLAY_FLAGS) {
    const value = patch[key];
    if (value !== undefined && value !== next[key]) {
      next[key] = value;
      changed = true;
    }
  }
  if (patch.area_label !== undefined) {
    const area = cleanText(patch.area_label)?.slice(0, SHOWCASE_AREA_MAX) ?? null;
    if (area !== next.area_label) {
      next.area_label = area;
      changed = true;
    }
  }
  if (patch.quote !== undefined) {
    const quote = cleanText(patch.quote)?.slice(0, SHOWCASE_QUOTE_MAX) ?? null;
    if (quote !== next.quote) {
      next.quote = quote;
      changed = true;
    }
  }
  if (changed) events.push('update');

  if (patch.submit) {
    if (next.status === 'approved' && !hasUnreviewedEdit(next)) {
      throw new ShowcaseRuleError('nothing_to_review', 'ร้านแสดงอยู่บนเว็บแล้ว ไม่มีอะไรเปลี่ยนให้ตรวจ');
    }
    next.status = 'pending';
    next.submitted_at = iso;
    next.reject_reason = null;
    events.push('submit');
  }

  return { next, events };
}

/**
 * Apply a super_admin review decision. Rejecting a re-submission keeps the
 * snapshot that is already live; `unpublish` takes the shop off the page.
 *
 * @throws ShowcaseRuleError when the action does not fit the current state.
 */
export function applyAdminAction(
  current: ShowcaseRow,
  action: ShowcaseAdminAction,
  input: { actorId: string; reason?: string | null },
  now: Date = new Date()
): ShowcaseRow {
  const iso = now.toISOString();
  const reviewed = { reviewed_by: input.actorId, reviewed_at: iso };

  switch (action) {
    case 'approve':
      if (!current.consent) throw new ShowcaseRuleError('consent_required', 'ร้านถอนความยินยอมแล้ว');
      if (current.status !== 'pending') throw new ShowcaseRuleError('not_pending', 'รายการนี้ไม่ได้รอตรวจ');
      return {
        ...current,
        ...reviewed,
        status: 'approved',
        published_quote: current.quote,
        published_at: current.published_at ?? iso,
        reject_reason: null,
      };
    case 'reject':
      if (current.status !== 'pending') throw new ShowcaseRuleError('not_pending', 'รายการนี้ไม่ได้รอตรวจ');
      return {
        ...current,
        ...reviewed,
        // A live shop keeps its reviewed snapshot; only the new edit is refused.
        status: current.published_at ? 'approved' : 'rejected',
        quote: current.published_at ? current.published_quote : current.quote,
        reject_reason: cleanText(input.reason)?.slice(0, 300) ?? null,
      };
    case 'unpublish':
      if (!current.published_at) throw new ShowcaseRuleError('not_published', 'ร้านนี้ไม่ได้แสดงอยู่บนเว็บ');
      return {
        ...current,
        ...reviewed,
        status: 'rejected',
        published_quote: null,
        published_at: null,
        featured: false,
        reject_reason: cleanText(input.reason)?.slice(0, 300) ?? null,
      };
    case 'feature':
    case 'unfeature':
      if (!isShowcasePublished(current)) throw new ShowcaseRuleError('not_published', 'ร้านนี้ไม่ได้แสดงอยู่บนเว็บ');
      return { ...current, featured: action === 'feature' };
  }
}

export type ShowcaseEligibility = { ok: boolean; reasons: string[] };

/**
 * Review hints for the admin list: a shop worth showing has LINE connected and
 * real bookings, and is not in demo mode. Advisory only — the admin decides.
 */
export function showcaseEligibility(input: { lineConnected: boolean; realBookings: number; demoMode: boolean }): ShowcaseEligibility {
  const reasons: string[] = [];
  if (input.demoMode) reasons.push('ยังอยู่ในโหมดทดลอง');
  if (!input.lineConnected) reasons.push('ยังไม่เชื่อม LINE');
  if (input.realBookings < SHOWCASE_MIN_REAL_BOOKINGS) reasons.push(`คิวจริง ${input.realBookings} (< ${SHOWCASE_MIN_REAL_BOOKINGS})`);
  return { ok: reasons.length === 0, reasons };
}

/** What the landing page renders for one shop. Only fields the shop allowed. */
export type PublicShowcaseCard = {
  id: string;
  name: string;
  logoUrl: string | null;
  businessType: string | null;
  area: string | null;
  quote: string | null;
  bookingUrl: string | null;
  featured: boolean;
};

export type ShowcaseShopFields = {
  id: string;
  name: string;
  shop_key: string | null;
  logo_url: string | null;
  business_type: string | null;
  liff_id: string | null;
  liff_id_login_shop?: string | null;
};

/** Accept only https image URLs for the public page. */
function safeLogoUrl(raw: string | null): string | null {
  if (!raw) return null;
  try {
    return new URL(raw).protocol === 'https:' ? raw : null;
  } catch {
    return null;
  }
}

/**
 * Build the public card from a published row. Fields the shop switched off are
 * dropped here, server side, so they never reach the browser.
 */
export function toPublicShowcaseCard(row: ShowcaseRow, shop: ShowcaseShopFields, appUrl: string | null): PublicShowcaseCard {
  const type = row.show_business_type && isBusinessType(shop.business_type) ? BUSINESS_TYPE_LABELS[shop.business_type] : null;
  return {
    id: shop.id,
    name: shop.name,
    logoUrl: row.show_logo ? safeLogoUrl(shop.logo_url) : null,
    businessType: type,
    area: row.show_area ? row.area_label : null,
    quote: row.published_quote,
    bookingUrl: row.show_booking_link
      ? resolveCustomerLiffUrl({ shopKey: shop.shop_key, liffId: shop.liff_id, liffIdLoginShop: shop.liff_id_login_shop, tab: 'booking', appUrl }) ?? null
      : null,
    featured: row.featured,
  };
}

/** Featured first, then the longest-running shops. */
export function sortShowcaseCards<T extends { featured: boolean }>(cards: T[]): T[] {
  return cards
    .map((card, index) => ({ card, index }))
    .sort((a, b) => Number(b.card.featured) - Number(a.card.featured) || a.index - b.index)
    .map((x) => x.card);
}
