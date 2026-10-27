import { describe, expect, it } from 'vitest';
import {
  SHOWCASE_CONSENT_VERSION,
  SHOWCASE_QUOTE_MAX,
  ShowcaseRuleError,
  applyAdminAction,
  applyOwnerPatch,
  emptyShowcaseRow,
  hasUnreviewedEdit,
  isShowcasePublished,
  shouldShowShowcasePrompt,
  showcaseEligibility,
  sortShowcaseCards,
  toPublicShowcaseCard,
  type ShowcaseRow,
} from './showcase-rules';

const NOW = new Date('2026-10-27T03:00:00Z');
const LATER = new Date('2026-10-28T03:00:00Z');
const ADMIN = { actorId: 'admin-1' };

function fresh(): ShowcaseRow {
  return emptyShowcaseRow('shop-1', 'co-1');
}

/** Consented, quote set, submitted and approved. */
function live(): ShowcaseRow {
  const consented = applyOwnerPatch(fresh(), { consent: true, quote: 'ลูกค้าจองเองได้' }, NOW).next;
  const pending = applyOwnerPatch(consented, { submit: true }, NOW).next;
  return applyAdminAction(pending, 'approve', ADMIN, NOW);
}

describe('applyOwnerPatch', () => {
  it('records consent with version and time', () => {
    const { next, events } = applyOwnerPatch(fresh(), { consent: true }, NOW);
    expect(next.consent).toBe(true);
    expect(next.consent_version).toBe(SHOWCASE_CONSENT_VERSION);
    expect(next.consented_at).toBe(NOW.toISOString());
    expect(next.status).toBe('draft');
    expect(events).toEqual(['consent']);
  });

  it('refuses field changes and submit without consent', () => {
    expect(() => applyOwnerPatch(fresh(), { quote: 'x' }, NOW)).toThrow(ShowcaseRuleError);
    expect(() => applyOwnerPatch(fresh(), { submit: true }, NOW)).toThrow(ShowcaseRuleError);
  });

  it('allows consent and fields in one request', () => {
    const { next, events } = applyOwnerPatch(fresh(), { consent: true, show_logo: false, quote: '  ดีมาก   ครับ ' }, NOW);
    expect(next.show_logo).toBe(false);
    expect(next.quote).toBe('ดีมาก ครับ');
    expect(events).toEqual(['consent', 'update']);
  });

  it('caps the quote length and turns blank into null', () => {
    const consented = applyOwnerPatch(fresh(), { consent: true }, NOW).next;
    expect(applyOwnerPatch(consented, { quote: 'ก'.repeat(200) }, NOW).next.quote).toHaveLength(SHOWCASE_QUOTE_MAX);
    expect(applyOwnerPatch(consented, { quote: '   ' }, NOW).next.quote).toBeNull();
  });

  it('does not log an update when nothing changed', () => {
    const consented = applyOwnerPatch(fresh(), { consent: true }, NOW).next;
    expect(applyOwnerPatch(consented, { show_logo: true }, NOW).events).toEqual([]);
  });

  it('withdrawing consent clears the published snapshot and featured flag', () => {
    const featured = applyAdminAction(live(), 'feature', ADMIN, NOW);
    const { next, events } = applyOwnerPatch(featured, { consent: false, quote: 'ignored' }, LATER);
    expect(events).toEqual(['revoke']);
    expect(next.status).toBe('revoked');
    expect(next.published_at).toBeNull();
    expect(next.published_quote).toBeNull();
    expect(next.featured).toBe(false);
    expect(isShowcasePublished(next)).toBe(false);
  });

  it('refuses a submit when a live shop has nothing new', () => {
    expect(() => applyOwnerPatch(live(), { submit: true }, LATER)).toThrow(/ไม่มีอะไรเปลี่ยน/);
  });

  it('an edit after approval stays unreviewed until submitted', () => {
    const edited = applyOwnerPatch(live(), { quote: 'ข้อความใหม่' }, LATER).next;
    expect(hasUnreviewedEdit(edited)).toBe(true);
    expect(edited.published_quote).toBe('ลูกค้าจองเองได้');
    const resubmitted = applyOwnerPatch(edited, { submit: true }, LATER).next;
    expect(resubmitted.status).toBe('pending');
    expect(isShowcasePublished(resubmitted)).toBe(true);
  });

  it('re-consent after revoke starts from draft', () => {
    const revoked = applyOwnerPatch(live(), { consent: false }, LATER).next;
    const { next } = applyOwnerPatch(revoked, { consent: true }, LATER);
    expect(next.status).toBe('draft');
    expect(isShowcasePublished(next)).toBe(false);
  });
});

describe('applyAdminAction', () => {
  it('approve publishes the submitted quote', () => {
    const row = live();
    expect(row.status).toBe('approved');
    expect(row.published_quote).toBe('ลูกค้าจองเองได้');
    expect(row.published_at).toBe(NOW.toISOString());
    expect(row.reviewed_by).toBe('admin-1');
    expect(isShowcasePublished(row)).toBe(true);
  });

  it('approve needs a pending row with consent', () => {
    const consented = applyOwnerPatch(fresh(), { consent: true }, NOW).next;
    expect(() => applyAdminAction(consented, 'approve', ADMIN, NOW)).toThrow(ShowcaseRuleError);
    const pending = applyOwnerPatch(consented, { submit: true }, NOW).next;
    expect(() => applyAdminAction({ ...pending, consent: false }, 'approve', ADMIN, NOW)).toThrow(ShowcaseRuleError);
  });

  it('reject of a first submission is not published', () => {
    const pending = applyOwnerPatch(applyOwnerPatch(fresh(), { consent: true }, NOW).next, { submit: true }, NOW).next;
    const row = applyAdminAction(pending, 'reject', { ...ADMIN, reason: 'โลโก้ไม่ชัด' }, NOW);
    expect(row.status).toBe('rejected');
    expect(row.reject_reason).toBe('โลโก้ไม่ชัด');
    expect(isShowcasePublished(row)).toBe(false);
  });

  it('reject of a re-submission keeps the live snapshot and restores the quote', () => {
    const pending = applyOwnerPatch(applyOwnerPatch(live(), { quote: 'โฆษณาเกินจริง' }, LATER).next, { submit: true }, LATER).next;
    const row = applyAdminAction(pending, 'reject', { ...ADMIN, reason: 'เกินจริง' }, LATER);
    expect(row.status).toBe('approved');
    expect(row.quote).toBe('ลูกค้าจองเองได้');
    expect(row.published_quote).toBe('ลูกค้าจองเองได้');
    expect(row.published_at).toBe(NOW.toISOString());
    expect(row.reject_reason).toBe('เกินจริง');
  });

  it('unpublish takes the shop off the page', () => {
    const row = applyAdminAction(applyAdminAction(live(), 'feature', ADMIN, NOW), 'unpublish', { ...ADMIN, reason: 'ร้องเรียน' }, LATER);
    expect(row.status).toBe('rejected');
    expect(row.featured).toBe(false);
    expect(isShowcasePublished(row)).toBe(false);
    expect(() => applyAdminAction(row, 'unpublish', ADMIN, LATER)).toThrow(ShowcaseRuleError);
  });

  it('feature needs a published row', () => {
    expect(() => applyAdminAction(fresh(), 'feature', ADMIN, NOW)).toThrow(ShowcaseRuleError);
    expect(applyAdminAction(live(), 'feature', ADMIN, NOW).featured).toBe(true);
  });
});

describe('showcaseEligibility', () => {
  it('flags demo, missing LINE and low bookings', () => {
    expect(showcaseEligibility({ lineConnected: true, realBookings: 20, demoMode: false })).toEqual({ ok: true, reasons: [] });
    const result = showcaseEligibility({ lineConnected: false, realBookings: 3, demoMode: true });
    expect(result.ok).toBe(false);
    expect(result.reasons).toHaveLength(3);
  });
});

describe('toPublicShowcaseCard', () => {
  const shop = {
    id: 'shop-1',
    name: 'ร้านตัดผมบ้านสวน',
    shop_key: 'SHOP-ABC123',
    logo_url: 'https://cdn.example.com/logo.png',
    business_type: 'salon',
    liff_id: '1234567890-abcdefgh',
  };

  it('includes only the fields the shop allowed', () => {
    const row = { ...live(), area_label: 'นนทบุรี' };
    const full = toPublicShowcaseCard(row, shop, 'https://app.example.com');
    expect(full.logoUrl).toBe(shop.logo_url);
    expect(full.area).toBe('นนทบุรี');
    expect(full.quote).toBe('ลูกค้าจองเองได้');
    expect(full.bookingUrl).toContain('liff.line.me/1234567890-abcdefgh');
    expect(full.bookingUrl).toContain('tab=booking');

    const hidden = toPublicShowcaseCard(
      { ...row, show_logo: false, show_area: false, show_business_type: false, show_booking_link: false },
      shop,
      'https://app.example.com'
    );
    expect(hidden).toMatchObject({ logoUrl: null, area: null, businessType: null, bookingUrl: null });
  });

  it('shows the published quote, never an unreviewed edit', () => {
    const edited = applyOwnerPatch(live(), { quote: 'ยังไม่ตรวจ' }, LATER).next;
    expect(toPublicShowcaseCard(edited, shop, null).quote).toBe('ลูกค้าจองเองได้');
  });

  it('drops non-https logos', () => {
    expect(toPublicShowcaseCard(live(), { ...shop, logo_url: 'javascript:alert(1)' }, null).logoUrl).toBeNull();
    expect(toPublicShowcaseCard(live(), { ...shop, logo_url: 'http://x.test/a.png' }, null).logoUrl).toBeNull();
  });
});

describe('sortShowcaseCards', () => {
  it('puts featured first and keeps the rest in order', () => {
    const cards = [
      { id: 'a', featured: false },
      { id: 'b', featured: true },
      { id: 'c', featured: false },
    ];
    expect(sortShowcaseCards(cards).map((c) => c.id)).toEqual(['b', 'a', 'c']);
  });
});

describe('shouldShowShowcasePrompt', () => {
  const owner = { isOwner: true, demoMode: false };

  it('shows once to an owner who never chose', () => {
    expect(shouldShowShowcasePrompt(fresh(), owner)).toBe(true);
    expect(shouldShowShowcasePrompt({ ...fresh(), prompt_dismissed_at: NOW.toISOString() }, owner)).toBe(false);
  });

  it('hides for staff, demo shops, consented and revoked shops', () => {
    expect(shouldShowShowcasePrompt(fresh(), { isOwner: false, demoMode: false })).toBe(false);
    expect(shouldShowShowcasePrompt(fresh(), { isOwner: true, demoMode: true })).toBe(false);
    expect(shouldShowShowcasePrompt(applyOwnerPatch(fresh(), { consent: true }, NOW).next, owner)).toBe(false);
    expect(shouldShowShowcasePrompt(applyOwnerPatch(live(), { consent: false }, LATER).next, owner)).toBe(false);
  });
});
