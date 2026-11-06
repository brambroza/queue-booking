import { describe, expect, it } from 'vitest';
import { sportsCourtScenario as court } from '@/lib/demo/scenarios/sports-court';
import { templateForBusiness } from '@/lib/line/rich-menu/templates';
import { computeAmount, formatBaht } from './amount';
import { nextHint } from './hints';
import { resolveMenuTap } from './menu';
import { createInitialState, nextQueueNo, simReduce, staffOpsFor } from './reducer';
import { buildSandboxSignageData } from './signage-data';
import { buildSlotTimes, firstDayWithRoom, markSlots } from './slots';
import { addDaysIso, bangkokStamp, fromMinutes, toMinutes } from './time';
import type { SimAction, SimState } from './types';

const TODAY = '2026-11-06';
const EARLY = { date: TODAY, time: '07:00:00' };

function start(paymentOn: boolean): SimState {
  return createInitialState(court, { paymentOn, today: TODAY });
}

function book(over: Partial<Extract<SimAction, { type: 'book' }>> = {}): Extract<SimAction, { type: 'book' }> {
  return {
    type: 'book',
    serviceKey: 'badminton',
    resourceCode: 'C1',
    date: TODAY,
    time: '10:00',
    customerName: 'คุณทดลอง',
    phone: '0812345678',
    now: EARLY,
    ...over,
  };
}

describe('time helpers', () => {
  it('converts minutes both ways and clamps at 23:59', () => {
    expect(toMinutes('08:30')).toBe(510);
    expect(fromMinutes(510)).toBe('08:30');
    expect(fromMinutes(1440)).toBe('23:59');
  });
  it('adds days across a month end', () => {
    expect(addDaysIso('2026-11-30', 1)).toBe('2026-12-01');
  });
  it('reads Bangkok time, not UTC', () => {
    expect(bangkokStamp(new Date('2026-11-05T18:30:00Z'))).toMatchObject({ date: '2026-11-06', time: '01:30:00' });
  });
});

describe('buildSlotTimes', () => {
  it('treats 00:00 close as end of day', () => {
    const times = buildSlotTimes('08:00', '00:00', 60);
    expect(times[0]).toBe('08:00');
    expect(times.at(-1)).toBe('23:00');
    expect(times).toHaveLength(16);
  });
  it('stops before the close time', () => {
    expect(buildSlotTimes('09:00', '11:00', 30)).toEqual(['09:00', '09:30', '10:00', '10:30']);
  });
});

describe('markSlots', () => {
  const service = court.services[0];
  const times = ['17:00', '18:00', '19:00', '21:00'];
  const base = { today: TODAY, times, service, queues: start(true).queues };

  it('marks a resource full when a sample queue overlaps it', () => {
    const slots = markSlots({ ...base, date: TODAY, now: EARLY, resourceCode: 'C2' });
    expect(slots.find((s) => s.time === '18:00')).toMatchObject({ state: 'full', booked: 1, capacity: 1 });
    expect(slots.find((s) => s.time === '19:00')?.state).toBe('open');
  });
  it('repeats sample queues on other days', () => {
    const slots = markSlots({ ...base, date: addDaysIso(TODAY, 1), now: EARLY, resourceCode: 'C2' });
    expect(slots.find((s) => s.time === '18:00')?.state).toBe('full');
  });
  it('marks started slots past with the Bangkok clock', () => {
    const slots = markSlots({ ...base, date: TODAY, now: { date: TODAY, time: '18:30:00' }, resourceCode: 'C3' });
    expect(slots.find((s) => s.time === '17:00')?.state).toBe('past');
    expect(slots.find((s) => s.time === '18:00')?.state).toBe('past');
    expect(slots.find((s) => s.time === '19:00')?.state).toBe('full');
    expect(slots.find((s) => s.time === '21:00')?.state).toBe('open');
  });
  it('counts service capacity per start time when no resource is chosen', () => {
    const slots = markSlots({ ...base, date: TODAY, now: EARLY, resourceCode: null });
    expect(slots.find((s) => s.time === '18:00')).toMatchObject({ state: 'full', booked: 1, capacity: 1 });
  });
  it('ignores cancelled queues', () => {
    const queues = base.queues.map((q) => (q.queueNo === 'A002' ? { ...q, status: 'cancelled' as const } : q));
    const slots = markSlots({ ...base, queues, date: TODAY, now: EARLY, resourceCode: 'C2' });
    expect(slots.find((s) => s.time === '18:00')?.state).toBe('open');
  });
  it('picks the first day that has room', () => {
    expect(firstDayWithRoom(['a', 'b', 'c'], (d) => d === 'b')).toBe('b');
    expect(firstDayWithRoom(['a', 'b'], () => false)).toBe('a');
  });
});

describe('computeAmount', () => {
  it('is nothing due when payment is off', () => {
    expect(computeAmount(court, 'badminton', 'C1', false)).toMatchObject({ total: 180, due: 0, mode: 'none' });
  });
  it('uses the resource unit price when the service price is 0', () => {
    expect(computeAmount(court, 'badminton', 'C3', true)).toMatchObject({ total: 240, due: 240, mode: 'full' });
  });
  it('prefers the service price when it is set', () => {
    expect(computeAmount(court, 'coach', 'C1', true)).toMatchObject({ total: 600, due: 600 });
  });
  it('multiplies by the number of queues', () => {
    expect(computeAmount(court, 'badminton', 'C1', true, 3).due).toBe(540);
  });
  it('skips payment when the price is 0', () => {
    expect(computeAmount(court, 'badminton', null, true)).toEqual({ total: 0, due: 0, mode: 'none' });
  });
  it('formats baht', () => {
    expect(formatBaht(1200)).toBe('฿1,200');
  });
});

describe('simReduce booking and payment', () => {
  it('confirms immediately when nothing is due', () => {
    const s = simReduce(court, start(false), book());
    const q = s.queues.find((x) => x.mine);
    expect(q).toMatchObject({ status: 'confirmed', payment: null, held: false });
    expect(s.chat.at(-1)?.alt).toContain('จองคิวสำเร็จ');
    expect(s.lastBookingId).toBe(q?.id);
  });
  it('holds the queue pending_approval until it is paid', () => {
    let s = simReduce(court, start(true), book());
    const q = s.queues.find((x) => x.mine)!;
    expect(q).toMatchObject({ status: 'pending_approval', held: true });
    expect(q.payment).toMatchObject({ status: 'pending_payment', amount: 180 });
    expect(s.chat.at(-1)?.alt).toContain('รอชำระเงิน');
    s = simReduce(court, s, { type: 'pay', queueId: q.id, method: 'omise_promptpay' });
    const paid = s.queues.find((x) => x.mine)!;
    expect(paid).toMatchObject({ status: 'confirmed', held: false });
    expect(paid.payment).toMatchObject({ status: 'paid', method: 'omise_promptpay' });
    expect(s.chat.some((m) => m.alt?.startsWith('ใบเสร็จรับเงิน'))).toBe(true);
    expect(s.chat.some((m) => m.alt?.startsWith('ร้านยืนยันคิว'))).toBe(true);
  });
  it('walks the slip path: upload, verify, paid', () => {
    let s = simReduce(court, start(true), book());
    const id = s.lastBookingId!;
    s = simReduce(court, s, { type: 'choose_transfer', queueId: id });
    s = simReduce(court, s, { type: 'submit_slip', queueId: id });
    expect(s.queues.find((q) => q.id === id)?.payment?.status).toBe('awaiting_verification');
    s = simReduce(court, s, { type: 'verify_slip', queueId: id });
    expect(s.queues.find((q) => q.id === id)).toMatchObject({ status: 'confirmed' });
  });
  it('lets staff approve a slip under review', () => {
    let s = simReduce(court, start(true), book());
    const id = s.lastBookingId!;
    s = simReduce(court, s, { type: 'submit_slip', queueId: id });
    s = simReduce(court, s, { type: 'staff', queueId: id, op: 'approve' });
    const q = s.queues.find((x) => x.id === id)!;
    expect(q.status).toBe('confirmed');
    expect(q.payment?.status).toBe('paid');
  });
  it('ends an approval service in pending_approval even after payment', () => {
    let s = simReduce(court, start(true), book({ serviceKey: 'coach', resourceCode: 'C1', time: '11:00' }));
    const id = s.lastBookingId!;
    expect(s.queues.find((q) => q.id === id)).toMatchObject({ status: 'pending_approval', held: false });
    expect(s.chat.at(-1)?.alt).toContain('รับคำขอจองแล้ว');
    s = simReduce(court, s, { type: 'pay', queueId: id, method: 'omise_promptpay' });
    expect(s.queues.find((q) => q.id === id)?.status).toBe('pending_approval');
    s = simReduce(court, s, { type: 'staff', queueId: id, op: 'approve' });
    expect(s.queues.find((q) => q.id === id)?.status).toBe('confirmed');
  });
  it('refuses a full or past slot', () => {
    const s = start(false);
    expect(simReduce(court, s, book({ resourceCode: 'C2', time: '18:00' }))).toBe(s);
    expect(simReduce(court, s, book({ now: { date: TODAY, time: '12:00:00' } }))).toBe(s);
  });
  it('issues unique queue numbers', () => {
    expect(nextQueueNo(start(false).queues)).toBe('A007');
    expect(nextQueueNo([{ queueNo: 'A001' }, { queueNo: 'A003' }])).toBe('A004');
  });
});

describe('simReduce staff flow', () => {
  it('calls, serves and completes; only a call of the visitor pushes to the chat', () => {
    let s = simReduce(court, start(false), book());
    const id = s.lastBookingId!;
    const before = s.chat.length;
    s = simReduce(court, s, { type: 'staff', queueId: id, op: 'call' });
    expect(s.chat.length).toBe(before + 1);
    expect(s.chat.at(-1)?.alt).toContain('ถึงคิวของคุณแล้ว');
    s = simReduce(court, s, { type: 'staff', queueId: id, op: 'call' });
    expect(s.chat.at(-1)?.alt).toContain('อีกครั้ง');
    s = simReduce(court, s, { type: 'staff', queueId: id, op: 'serve' });
    s = simReduce(court, s, { type: 'staff', queueId: id, op: 'complete' });
    expect(s.queues.find((q) => q.id === id)?.status).toBe('completed');

    const seedCall = simReduce(court, s, { type: 'staff', queueId: 'seed-A005', op: 'call' });
    expect(seedCall.chat.length).toBe(s.chat.length);
    expect(seedCall.queues.find((q) => q.id === 'seed-A005')?.status).toBe('called');
  });
  it('refuses a transition the status flow does not allow', () => {
    const s = start(false);
    expect(simReduce(court, s, { type: 'staff', queueId: 'seed-A001', op: 'call' })).toBe(s);
    expect(staffOpsFor('completed')).toEqual([]);
    expect(staffOpsFor('pending_approval')).toContain('approve');
  });
  it('appends a customer text and the bot reply', () => {
    const s = simReduce(court, start(false), { type: 'customer_text', text: 'สวัสดี', reply: 'ค่ะ' });
    expect(s.chat.slice(-2).map((m) => m.role)).toEqual(['customer', 'bot']);
  });
});

describe('buildSandboxSignageData', () => {
  it('shows called queues as now calling and confirmed ones in line', () => {
    const data = buildSandboxSignageData(court, start(false).queues, TODAY);
    expect(data.now_calling.map((p) => p.queue_number)).toEqual(expect.arrayContaining(['A002', 'A003']));
    expect(data.next_queue.map((p) => p.queue_number)).toContain('A005');
    expect(data.totals.served_today).toBe(1);
    expect(data.resources).toHaveLength(court.resources.length);
  });
  it('hides unapproved and other-day queues, shows the visitor once confirmed', () => {
    let s = simReduce(court, start(true), book());
    expect(buildSandboxSignageData(court, s.queues, TODAY).schedule.some((p) => p.queue_number === 'A007')).toBe(false);
    s = simReduce(court, s, { type: 'pay', queueId: s.lastBookingId!, method: 'omise_promptpay' });
    const data = buildSandboxSignageData(court, s.queues, TODAY);
    expect(data.schedule.find((p) => p.queue_number === 'A007')).toMatchObject({ customer_name: 'คุณทดลอง', resource_name: 'สนามแบด 1' });
    expect(buildSandboxSignageData(court, s.queues, addDaysIso(TODAY, 1)).schedule).toHaveLength(0);
  });
  it('orders the hero by call order', () => {
    let s = simReduce(court, start(false), { type: 'staff', queueId: 'seed-A005', op: 'call' });
    s = { ...s };
    expect(buildSandboxSignageData(court, s.queues, TODAY).now_calling[0].queue_number).toBe('A005');
  });
});

describe('hints and menu taps', () => {
  it('guides a visitor with no booking', () => {
    expect(nextHint({ screen: 'chat', mine: null, boardVisible: true })).toContain('เมนูจองคิว');
    expect(nextHint({ screen: 'liff', mine: null, boardVisible: true })).toContain('ยืนยันการจอง');
  });
  it('points to the back office after booking', () => {
    expect(nextHint({ screen: 'chat', mine: { status: 'confirmed', payment: null }, boardVisible: false })).toContain('แท็บ');
    expect(nextHint({ screen: 'liff', mine: { status: 'pending_approval', payment: { method: null, status: 'pending_payment', amount: 1 } }, boardVisible: true })).toContain('ชำระเงิน');
  });
  it('opens booking from the booking button and answers the rest in chat', () => {
    const config = templateForBusiness(court.type);
    const booking = config.buttons.find((b) => b.action.type === 'liff_booking')!;
    expect(resolveMenuTap(booking, null)).toEqual({ kind: 'open_booking' });
    const member = config.buttons.find((b) => b.action.type === 'liff_member');
    if (member) {
      expect(resolveMenuTap(member, null).kind).toBe('text');
      expect(resolveMenuTap(member, { queueNo: 'A007' })).toEqual({ kind: 'open_member' });
    }
  });
});

describe('flow', () => {
  it('requires a resource for a court and skips none-pickers', async () => {
    const { stepsFor, canContinue, eligibleResources, stepperPill } = await import('./flow');
    expect(stepsFor(court, null)).toEqual(['service', 'datetime', 'confirm']);
    expect(stepsFor(court, 'futsal')).toEqual(['service', 'resource', 'datetime', 'confirm']);
    expect(stepsFor({ ...court, resourcePicker: 'none' }, 'futsal')).toEqual(['service', 'datetime', 'confirm']);
    expect(stepsFor({ ...court, partySize: { min: 1, max: 4, label: 'คน' } }, 'futsal')).toContain('party');
    expect(eligibleResources(court, 'futsal').map((r) => r.code)).toEqual(['F1']);
    const none = { serviceKey: 'futsal', resourceCode: null, time: null };
    expect(canContinue('resource', none, court)).toBe(false);
    expect(canContinue('resource', none, { ...court, resourcePicker: 'optional' })).toBe(true);
    expect(canContinue('datetime', none, court)).toBe(false);
    expect(stepperPill('confirm')).toBe(2);
  });
});
