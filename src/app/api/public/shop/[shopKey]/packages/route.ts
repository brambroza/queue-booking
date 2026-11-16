import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { clientIp, hitRateLimit, tooManyRequests } from '@/lib/security/rate-limit';
import { getTodayISOInBangkok } from '@/lib/utils/date-format';
import { loadCustomerPackages, loadShopPackagesPublic, toPublicCustomerPackage } from '@/lib/packages/packages-server';
import { packageQrUrl, resolveLiffPackageCaller } from '@/lib/packages/liff-package-auth';
import { composeLiffPackages } from '@/lib/packages/liff-view';
import { isLiffPackagesAlwaysShown } from '@/lib/booking/display-settings';

const schema = z.object({
  line_user_id: z.string().max(64).optional(),
  id_token: z.string().max(4096).optional(),
});

/**
 * LIFF: packages the caller owns + what the shop sells online. Not called on
 * page open any more (catalog rides /meta, owned packages ride /me); LIFF uses
 * it only to refresh after a purchase, a slip upload or a package booking.
 * POST `{ id_token }` → `{ enabled, catalog, mine, can_buy, payee }`.
 * `enabled:false` (nothing else) when the plan is below Professional or the
 * tables are missing — LIFF then hides the whole package UI. Packages already
 * bought are still returned after a downgrade so customers can use them.
 */
export async function POST(req: Request, { params }: { params: Promise<{ shopKey: string }> }) {
  const { shopKey } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const admin = createAdminClient();
  if (!(await hitRateLimit(admin, 'liffProfile', clientIp(req)))) return tooManyRequests();

  const caller = await resolveLiffPackageCaller(admin, shopKey, parsed.data.line_user_id, parsed.data.id_token);
  if (!caller.ok) return NextResponse.json({ error: caller.error }, { status: caller.status });
  const { shop, customerId } = caller;

  const today = getTodayISOInBangkok();
  const mineRows = customerId ? await loadCustomerPackages(admin, shop.id, customerId) : [];
  if (mineRows === null) return NextResponse.json({ data: composeLiffPackages(null, null, Boolean(customerId)) });
  const mine = mineRows.map((row) => ({
    ...toPublicCustomerPackage(row, today),
    qr_image_url: ['pending_payment', 'rejected'].includes(row.status) ? packageQrUrl(shop.shop_key, row.id, Number(row.price_paid ?? 0)) : null,
  }));

  const alwaysShown = await isLiffPackagesAlwaysShown(admin, shop.id);
  const shopPackages = await loadShopPackagesPublic(admin, shop.id, alwaysShown).catch(() => null);
  // Same rule the LIFF applies to the /meta + /me copies.
  return NextResponse.json({ data: composeLiffPackages(shopPackages, mine, Boolean(customerId)) });
}
