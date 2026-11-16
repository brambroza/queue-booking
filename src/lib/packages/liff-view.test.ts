import { describe, expect, it } from 'vitest';
import { composeLiffPackages, type LiffOwnedPackage, type ShopPackagesPublic } from './liff-view';

const SHOP: ShopPackagesPublic = {
  plan_allowed: true,
  always_shown: false,
  catalog: [{ id: 't1', name: '10 ชม.', description: null, credit_minutes: 600, price: 4500, valid_days: 90, service_ids: [], usage_windows: [] }],
  payee: { name: 'ร้าน', promptpay_masked: 'xxx-4821', bank_name: null, bank_account_no: null, bank_account_name: null },
};
const OWNED: LiffOwnedPackage = {
  id: 'p1', name: '10 ชม.', total_minutes: 600, remaining_minutes: 300, price_paid: 4500, expires_on: null, status: 'active',
  service_ids: [], usage_windows: [], payment_expires_at: null, reject_reason: null, usable: true, qr_image_url: null,
};

describe('composeLiffPackages', () => {
  it('hides the section for a shop that does not use packages', () => {
    expect(composeLiffPackages(null, null, true).enabled).toBe(false);
  });

  it('Professional shop with nothing sold online and switch off = hidden', () => {
    expect(composeLiffPackages({ ...SHOP, catalog: [] }, [], true).enabled).toBe(false);
  });

  it('switch on shows the empty section', () => {
    expect(composeLiffPackages({ ...SHOP, catalog: [], always_shown: true }, [], true).enabled).toBe(true);
  });

  it('a held package always shows, even after a downgrade', () => {
    const view = composeLiffPackages({ ...SHOP, plan_allowed: false }, [OWNED], true);
    expect(view.enabled).toBe(true);
    expect(view.catalog).toEqual([]);
    expect(view.can_buy).toBe(false);
  });

  it('cancelled packages are not listed', () => {
    expect(composeLiffPackages({ ...SHOP, catalog: [] }, [{ ...OWNED, status: 'cancelled' }], true).enabled).toBe(false);
  });

  it('buying needs PromptPay and a customer record', () => {
    expect(composeLiffPackages(SHOP, [], true).can_buy).toBe(true);
    expect(composeLiffPackages({ ...SHOP, payee: null }, [], true).can_buy).toBe(false);
    const noMember = composeLiffPackages(SHOP, [], false);
    expect(noMember.can_buy).toBe(false);
    expect(noMember.needs_member).toBe(true);
  });
});
