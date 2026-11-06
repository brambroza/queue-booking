import { describe, expect, it } from 'vitest';
import { sportsCourtScenario } from '@/lib/demo/scenarios/sports-court';
import { explainFor, suggestions, tourStep, type TourContext } from './tour';

const ALL_EXPLAINED = new Set([
  'setup', 'intro', 'liff-service', 'liff-resource-required', 'liff-datetime-fixed_slot', 'liff-confirm-fixed_slot-free', 'liff-confirm-fixed_slot-pay',
  'booked-unpaid', 'pay-promptpay', 'pay-transfer', 'pay-bank_app', 'slip-sent', 'paid', 'approval', 'booked-free', 'called', 'completed',
]);

const base: TourContext = {
  phase: 'play',
  screen: 'chat',
  desktop: true,
  tab: 'customer',
  mine: null,
  paymentOn: true,
  scenario: sportsCourtScenario,
  liff: null,
  explained: ALL_EXPLAINED,
  explainIndex: 0,
  history: { servicesBooked: [], methodsUsed: [] },
};
const targets = (ctx: TourContext) => tourStep(ctx).candidates.map((c) => c.target);
const paying = (status: 'pending_payment' | 'awaiting_verification' | 'paid', method: 'omise_promptpay' | 'bank_transfer' = 'omise_promptpay') => ({
  method,
  status,
  amount: 180,
});

describe('sandbox tour — explain sequences', () => {
  it('explains both payment options before pointing at the start button', () => {
    const ctx = { ...base, phase: 'setup' as const, explained: new Set<string>() };
    const first = tourStep(ctx);
    expect(first.manual).toBe(true);
    expect(first.explainKey).toBe('setup');
    expect(first.candidates[0].target).toBe('setup-opt-online');
    expect(tourStep({ ...ctx, explainIndex: 1 }).candidates[0].target).toBe('setup-opt-shop');
    expect(targets({ ...ctx, explained: new Set(['setup']) })).toEqual(['setup-start', 'setup-choice']);
  });

  it('intro covers phone, chat, rich menu, board and TV on desktop; tabs on mobile', () => {
    const ctx = { ...base, explained: new Set(['setup']) };
    expect(explainFor(ctx)?.parts.map((p) => p.target)).toEqual(['role-customer', 'chat-messages', 'menu-all', 'role-shop', 'board-columns', 'area-tv']);
    expect(explainFor({ ...ctx, desktop: false })?.parts.map((p) => p.target).slice(-2)).toEqual(['tab-staff', 'tab-tv']);
    expect(tourStep({ ...ctx, explainIndex: 2 }).explainPos).toEqual({ index: 2, count: 6 });
  });

  it('LIFF explains depend on the screen and the service mode', () => {
    const ctx = { ...base, screen: 'liff' as const, explained: new Set(['setup', 'intro']) };
    const svc = explainFor({ ...ctx, liff: { screen: 'service', serviceKey: null, resourceCode: null, payMethod: null } });
    expect(svc?.key).toBe('liff-service');
    expect(svc?.parts[1].tips?.some((t) => t.includes('ร้านต้องกดอนุมัติ'))).toBe(true);
    const res = explainFor({ ...ctx, liff: { screen: 'resource', serviceKey: 'badminton', resourceCode: null, payMethod: null } });
    expect(res?.key).toBe('liff-resource-required');
    expect(res?.parts[0].tips?.[0]).toContain('บังคับเลือก');
    const coach = explainFor({ ...ctx, liff: { screen: 'confirm', serviceKey: 'coach', resourceCode: 'C1', payMethod: null } });
    expect(coach?.key).toBe('liff-confirm-request_approval-pay');
  });

  it('payment explains follow the chosen method', () => {
    const owing = { ...base, screen: 'liff' as const, mine: { status: 'pending_approval' as const, serviceKey: 'badminton', payment: paying('pending_payment') }, explained: new Set(['setup', 'intro']) };
    expect(explainFor({ ...owing, liff: { screen: 'done', serviceKey: 'badminton', resourceCode: 'C1', payMethod: null } })?.key).toBe('booked-unpaid');
    expect(explainFor({ ...owing, liff: { screen: 'done', serviceKey: 'badminton', resourceCode: 'C1', payMethod: 'transfer' } })?.parts.map((p) => p.target)).toEqual(['pay-account', 'pay-slip']);
  });

  it('skips explain sequences already seen', () => {
    expect(tourStep(base).manual).toBeFalsy();
  });
});

describe('sandbox tour — actions', () => {
  it('points at the booking menu, then LIFF controls', () => {
    expect(targets(base)).toEqual(['menu-booking']);
    expect(targets({ ...base, screen: 'liff' })[0]).toBe('liff-confirm');
  });

  it('sends mobile visitors to the right tab first', () => {
    expect(targets({ ...base, desktop: false, tab: 'staff' })).toEqual(['tab-customer']);
    const confirmed = { ...base, desktop: false, mine: { status: 'confirmed' as const, serviceKey: 'badminton', payment: null } };
    expect(targets(confirmed)).toEqual(['tab-staff']);
    expect(targets({ ...confirmed, tab: 'staff' })).toEqual(['board-mine']);
  });

  it('asks for payment before staff steps, slips go to staff approval', () => {
    const owing = { ...base, screen: 'liff' as const, mine: { status: 'pending_approval' as const, serviceKey: 'badminton', payment: paying('pending_payment') } };
    expect(targets(owing)).toEqual(['pay-send', 'pay-slip', 'pay-action', 'pay-methods']);
    expect(targets({ ...owing, screen: 'chat' })).toEqual(['menu-member']);
    const slip = { ...owing, mine: { ...owing.mine, payment: paying('awaiting_verification', 'bank_transfer') } };
    expect(tourStep(slip).candidates[0].title).toContain('อนุมัติสลิป');
  });

  it('walks staff through call, serve, complete and ends with suggestions', () => {
    for (const status of ['waiting', 'called', 'serving'] as const) expect(targets({ ...base, mine: { status, serviceKey: 'badminton', payment: null } })).toEqual(['board-mine']);
    const done = tourStep({ ...base, mine: { status: 'completed', serviceKey: 'badminton', payment: null } });
    expect(done.final).toBe(true);
    expect(done.milestone).toBe(done.total);
    expect(done.candidates[0].tips?.length).toBeGreaterThan(0);
  });

  it('suggests the paths not tried yet', () => {
    const tried = suggestions({ ...base, history: { servicesBooked: ['badminton', 'coach'], methodsUsed: ['bank_transfer'] } });
    expect(tried.some((t) => t.includes('อนุมัติก่อน'))).toBe(false);
    expect(tried.some((t) => t.includes('QR PromptPay'))).toBe(true);
    expect(suggestions({ ...base, paymentOn: false }).some((t) => t.includes('มีชำระเงินออนไลน์'))).toBe(true);
  });

  it('drops the payment milestone when payment is off', () => {
    expect(tourStep({ ...base, paymentOn: false }).total).toBe(tourStep(base).total - 1);
  });
});
