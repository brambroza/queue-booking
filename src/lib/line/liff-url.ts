import { isValidLiffId, normalizeLiffId } from '@/lib/line/liff-id';

/** Which LIFF tab the link should open: the booking form or the customer's own queues. */
export type LiffTab = 'booking' | 'account';

/**
 * Same URL shape the LIFF client, the rich menu and the bank-return page use
 * (`https://liff.line.me/{id}?shop_key=…&tab=…`). The LIFF endpoint registered
 * on LINE is the shared `/liff/booking-client`, which redirects on `tab`.
 *
 * @param liffId - Bare LIFF ID (`1234567890-abcdefgh`).
 * @param shopKey - `shops.shop_key`.
 * @param tab - Tab to land on.
 * @returns The `liff.line.me` deep link.
 */
export function buildLiffUri(liffId: string, shopKey: string, tab: LiffTab): string {
  const params = new URLSearchParams({ shop_key: shopKey, tab });
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
  const ordered = input.tab === 'account' ? [fromLogin, fromShop, fromEnv] : [fromShop, fromLogin, fromEnv];
  for (const raw of ordered) {
    const id = usableLiffId(raw);
    if (id) return buildLiffUri(id, shopKey, input.tab);
  }

  const appUrl = (input.appUrl ?? '').replace(/\/+$/, '');
  if (!appUrl) return undefined;
  const base = `${appUrl}/liff/${encodeURIComponent(shopKey)}`;
  return input.tab === 'account' ? `${base}/member` : base;
}
