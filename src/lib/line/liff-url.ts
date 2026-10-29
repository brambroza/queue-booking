import { isValidLiffId, normalizeLiffId } from '@/lib/line/liff-id';

/**
 * Which LIFF tab the link should open: the booking form, the customer's own
 * queues, or the order page for today's on-site queue (`/liff/{shopKey}/order`).
 */
export type LiffTab = 'booking' | 'account' | 'order';

/**
 * Same URL shape the LIFF client, the rich menu and the bank-return page use
 * (`https://liff.line.me/{id}?shop_key=…&tab=…`). The LIFF endpoint registered
 * on LINE is the shared `/liff/booking-client`, which redirects on `tab`.
 *
 * @param liffId - Bare LIFF ID (`1234567890-abcdefgh`).
 * @param shopKey - `shops.shop_key`.
 * @param tab - Tab to land on.
 * @param bookingId - Optional queue to focus; the account tab opens its payment panel when still payable.
 * @returns The `liff.line.me` deep link.
 */
export function buildLiffUri(liffId: string, shopKey: string, tab: LiffTab, bookingId?: string | null): string {
  const params = new URLSearchParams({ shop_key: shopKey, tab });
  if (bookingId) params.set('booking_id', bookingId);
  return `https://liff.line.me/${encodeURIComponent(liffId)}?${params.toString()}`;
}

/** Normalize + validate a stored LIFF id; returns null when unusable. */
function usableLiffId(raw: string | null | undefined): string | null {
  const id = normalizeLiffId(raw);
  return id && isValidLiffId(id) ? id : null;
}

export type CustomerLiffUrlInput = {
  shopKey: string | null | undefined;
  /** `shops.liff_id` — booking LIFF (raw value as stored; may be a full LIFF URL). */
  liffId?: string | null;
  /** `shops.liff_id_login_shop` — member LIFF, preferred for the account tab. */
  liffIdLoginShop?: string | null;
  tab: LiffTab;
  /** Queue the link is about (payment Flex) — LIFF opens that queue's payment panel. */
  bookingId?: string | null;
  /** `NEXT_PUBLIC_APP_URL`; used only when no LIFF ID is available. */
  appUrl?: string | null;
};

/**
 * Link for a customer-facing LINE button (Flex footer, quick reply).
 *
 * A plain app URL opens in LINE's in-app browser, outside the LIFF context, so
 * `liff.isLoggedIn()` is false and the page shows "กรุณาเปิดหน้านี้ผ่าน LINE LIFF".
 * This prefers a `liff.line.me` link; the ID order matches `getLiffCandidates`
 * in the LIFF client so both sides resolve the same app. Shops without any
 * LIFF ID keep the old direct link so the button does not disappear.
 *
 * @returns The link, or `undefined` when neither a LIFF ID nor an app URL exists.
 */
export function resolveCustomerLiffUrl(input: CustomerLiffUrlInput): string | undefined {
  const shopKey = (input.shopKey ?? '').trim();
  if (!shopKey) return undefined;

  const fromShop = input.liffId ?? null;
  const fromLogin = input.liffIdLoginShop ?? null;
  const fromEnv = process.env.LIFF_ID ?? process.env.NEXT_PUBLIC_LIFF_ID ?? null;
  const ordered = input.tab === 'booking' ? [fromShop, fromLogin, fromEnv] : [fromLogin, fromShop, fromEnv];
  for (const raw of ordered) {
    const id = usableLiffId(raw);
    if (id) return buildLiffUri(id, shopKey, input.tab, input.bookingId);
  }

  const appUrl = (input.appUrl ?? '').replace(/\/+$/, '');
  if (!appUrl) return undefined;
  const base = `${appUrl}/liff/${encodeURIComponent(shopKey)}`;
  const path = input.tab === 'booking' ? base : input.tab === 'order' ? `${base}/order` : `${base}/member`;
  return input.bookingId ? `${path}?booking_id=${encodeURIComponent(input.bookingId)}` : path;
}
