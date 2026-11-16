import type { SupabaseClient } from '@supabase/supabase-js';
import { pushMessage } from '@/lib/line/client';
import { resolveCustomerLiffUrl } from '@/lib/line/liff-url';
import { formatPackageMinutes } from './rules';

/**
 * Tell a customer about their package on LINE (activated / slip rejected).
 * One push from the shop's own OA; never throws. Customers without LINE get nothing.
 *
 * @returns Whether a push was sent.
 */
export async function safeNotifyPackageCustomer(
  admin: SupabaseClient,
  opts: {
    shopId: string;
    customerId: string;
    kind: 'activated' | 'rejected';
    packageName: string;
    remainingMinutes?: number;
    expiresOn?: string | null;
    reason?: string | null;
  },
): Promise<boolean> {
  try {
    const [{ data: shop }, { data: customer }] = await Promise.all([
      admin.from('shops').select('shop_key,line_channel_access_token,liff_id,liff_id_login_shop').eq('id', opts.shopId).maybeSingle(),
      admin.from('customers').select('line_user_id').eq('id', opts.customerId).eq('shop_id', opts.shopId).maybeSingle(),
    ]);
    const token = (shop as { line_channel_access_token?: string | null } | null)?.line_channel_access_token;
    const linePk = (customer as { line_user_id?: string | null } | null)?.line_user_id;
    if (!token || !linePk) return false;
    const { data: lineUser } = await admin.from('line_users').select('line_user_id').eq('id', linePk).eq('shop_id', opts.shopId).maybeSingle();
    const to = (lineUser as { line_user_id?: string | null } | null)?.line_user_id;
    if (!to) return false;

    const shopRow = shop as { shop_key?: string | null; liff_id?: string | null; liff_id_login_shop?: string | null };
    const url = shopRow.shop_key
      ? resolveCustomerLiffUrl({
          shopKey: shopRow.shop_key,
          liffId: shopRow.liff_id ?? null,
          liffIdLoginShop: shopRow.liff_id_login_shop ?? null,
          tab: 'account',
          appUrl: process.env.NEXT_PUBLIC_APP_URL ?? null,
        })
      : null;

    const text =
      opts.kind === 'activated'
        ? `แพ็กเกจ "${opts.packageName}" พร้อมใช้แล้ว\nคงเหลือ ${formatPackageMinutes(opts.remainingMinutes ?? 0)}${
            opts.expiresOn ? `\nใช้ได้ถึง ${opts.expiresOn.split('-').reverse().join('/')}` : ''
          }\nเลือก "ใช้แพ็กเกจ" ตอนจองคิวได้เลย${url ? `\n${url}` : ''}`
        : `สลิปซื้อแพ็กเกจ "${opts.packageName}" ยังไม่ผ่านการตรวจ${opts.reason ? `\nเหตุผล: ${opts.reason}` : ''}\nกรุณาส่งสลิปใหม่ที่หน้าสมาชิก${url ? `\n${url}` : ''}`;
    await pushMessage(token, to, [{ type: 'text', text }]);
    return true;
  } catch (e) {
    console.error('[packages] customer notify failed:', e instanceof Error ? e.message : e);
    return false;
  }
}
