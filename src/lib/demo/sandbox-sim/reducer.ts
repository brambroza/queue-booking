import type { BusinessScenario, ScenarioQueue } from '@/lib/demo/scenarios/types';
import { formatQueueNumber } from '@/lib/booking/queue-number';
import { bookingApprovedFlex, bookingCalledFlex, bookingConfirmFlex } from '@/lib/line/messages';
import { paymentReceiptFlex, slipReceivedFlex } from '@/lib/line/messages-payment';
import type { FlexNode } from '@/lib/line/flex-canvas';
import { formatThaiDateLabel } from '@/lib/utils/date-format';
import { computeAmount } from './amount';
import { markSlots, buildSlotTimes } from './slots';
import { fromMinutes, toMinutes } from './time';
import type { SimAction, SimChatMessage, SimQueue, SimState, StaffOp } from './types';

/** Customer name and phone the LIFF form is prefilled with. */
export const DEMO_CUSTOMER = { name: 'คุณทดลอง', phone: '0812345678' } as const;

/**
 * Thai label per queue status, as staff see it.
 */
export const STATUS_LABEL_TH: Record<string, string> = {
  pending_approval: 'รอร้านยืนยัน',
  confirmed: 'ยืนยันแล้ว',
  checked_in: 'มาถึงแล้ว',
  waiting: 'รอเรียก',
  called: 'เรียกแล้ว',
  serving: 'กำลังให้บริการ',
  completed: 'เสร็จสิ้น',
  cancelled: 'ยกเลิก',
  no_show: 'ไม่มา',
};

/**
 * Build the initial in-memory shop from a scenario.
 *
 * Sample queues are stamped with `today`; when online payment is off their
 * payment info is dropped so the board never shows a payment that the chosen
 * mode does not have.
 *
 * @param scenario - Business scenario.
 * @param opts.paymentOn - Visitor's choice in the setup step.
 * @param opts.today - Bangkok date `YYYY-MM-DD`.
 * @returns Fresh state.
 */
export function createInitialState(scenario: BusinessScenario, opts: { paymentOn: boolean; today: string }): SimState {
  const queues = scenario.queues.map((q, i) => seedQueue(scenario, q, opts, i));
  const chat: SimChatMessage[] = scenario.chats.map((c, i) => ({ id: `seed-${i}`, role: c.role, text: c.text }));
  return { paymentOn: opts.paymentOn, today: opts.today, queues, chat, seq: queues.length + 1, lastBookingId: null };
}

function seedQueue(
  scenario: BusinessScenario,
  q: ScenarioQueue,
  opts: { paymentOn: boolean; today: string },
  index: number,
): SimQueue {
  const service = scenario.services.find((s) => s.key === q.serviceKey);
  const called = q.status === 'called' || q.status === 'serving' || q.status === 'completed';
  return {
    id: `seed-${q.queueNo}`,
    queueNo: q.queueNo,
    serviceKey: q.serviceKey,
    resourceCode: q.resourceCode ?? null,
    date: opts.today,
    time: q.time,
    durationMinutes: service?.durationMinutes ?? 60,
    status: q.status,
    customerName: q.customerName,
    nickname: q.nickname,
    phone: q.phone,
    partySize: q.partySize,
    payment: opts.paymentOn && q.payment ? { method: q.payment.method, status: q.payment.status, amount: 0 } : null,
    held: false,
    callCount: q.status === 'called' ? 1 : 0,
    calledSeq: called ? index + 1 : null,
    mine: false,
    seed: true,
  };
}

/**
 * Next free queue number: `A001`, `A002`, … skipping numbers already used.
 *
 * @param queues - Queues in the shop.
 */
export function nextQueueNo(queues: Pick<SimQueue, 'queueNo'>[]): string {
  const used = new Set(queues.map((q) => q.queueNo));
  let ordinal = queues.length + 1;
  while (used.has(formatQueueNumber(ordinal))) ordinal += 1;
  return formatQueueNumber(ordinal);
}

/**
 * Staff buttons available for a status, in the order they are shown.
 * Mirrors `src/lib/booking/status-flow.ts` (approve → call → serve → complete).
 *
 * @param status - Current status.
 * @returns Operations staff may press.
 */
export function staffOpsFor(status: SimQueue['status']): StaffOp[] {
  switch (status) {
    case 'pending_approval':
      return ['approve', 'cancel'];
    case 'confirmed':
    case 'checked_in':
    case 'waiting':
      return ['call', 'no_show'];
    case 'called':
      return ['serve', 'call', 'no_show'];
    case 'serving':
      return ['complete'];
    default:
      return [];
  }
}

/** Thai label per staff operation (the button text). `call` on a called queue reads "เรียกซ้ำ" in the UI. */
export const STAFF_OP_LABEL: Record<StaffOp, string> = {
  approve: 'อนุมัติ',
  call: 'เรียกคิว',
  serve: 'เริ่มบริการ',
  complete: 'เสร็จสิ้น',
  no_show: 'ไม่มา',
  cancel: 'ปฏิเสธ',
};

/** Fields every Flex builder needs for one queue. */
function flexFacts(scenario: BusinessScenario, q: SimQueue) {
  const service = scenario.services.find((s) => s.key === q.serviceKey);
  const resource = q.resourceCode ? scenario.resources.find((r) => r.code === q.resourceCode) : undefined;
  return {
    shopName: scenario.shopName,
    queueNumber: q.queueNo,
    branch: scenario.branchName,
    service: service?.name ?? q.serviceKey,
    date: formatThaiDateLabel(q.date),
    time: q.time,
    assignedTo: resource?.name ?? null,
    assignedLabel: scenario.resourceLabel,
  };
}

function flexMessage(id: string, message: { altText: string; contents: unknown }): SimChatMessage {
  return { id, role: 'bot', flex: message.contents as FlexNode, alt: message.altText };
}

function patch(state: SimState, id: string, fn: (q: SimQueue) => SimQueue): SimState {
  return { ...state, queues: state.queues.map((q) => (q.id === id ? fn(q) : q)) };
}

/** Mark a queue paid, release a payment hold and push the receipt (and approval) to the chat. */
function settlePaid(scenario: BusinessScenario, state: SimState, queueId: string): SimState {
  const before = state.queues.find((q) => q.id === queueId);
  if (!before || !before.payment || before.payment.status === 'paid') return state;
  let next = patch(state, queueId, (q) => ({
    ...q,
    payment: q.payment ? { ...q.payment, status: 'paid' } : q.payment,
    status: q.held && q.status === 'pending_approval' ? 'confirmed' : q.status,
    held: false,
  }));
  const after = next.queues.find((q) => q.id === queueId);
  if (after?.mine) {
    const facts = flexFacts(scenario, after);
    const messages: SimChatMessage[] = [
      flexMessage(
        `m${next.seq}`,
        paymentReceiptFlex({
          ...facts,
          amountTHB: after.payment?.amount ?? 0,
          receiptRef: `DEMO-${after.queueNo}`,
          paidAt: new Date().toISOString(),
        }),
      ),
    ];
    if (before.held && after.status === 'confirmed') {
      messages.push(flexMessage(`m${next.seq + 1}`, bookingApprovedFlex({ ...facts, bookingId: after.id })));
    }
    next = { ...next, seq: next.seq + messages.length, chat: [...next.chat, ...messages] };
  }
  return next;
}

/**
 * Pure state transition of the sandbox. `scenario` is bound by the caller
 * (`reducerFor`), so tests and the UI share one implementation.
 *
 * @param scenario - Business scenario.
 * @param state - Current state.
 * @param action - What happened.
 * @returns Next state (same object when the action is refused).
 */
export function simReduce(scenario: BusinessScenario, state: SimState, action: SimAction): SimState {
  switch (action.type) {
    case 'book': {
      const service = scenario.services.find((s) => s.key === action.serviceKey);
      if (!service) return state;
      // Refuse a slot that filled up or started meanwhile, like the real `/book`.
      const slot = markSlots({
        date: action.date,
        today: state.today,
        now: action.now,
        times: [action.time],
        service,
        resourceCode: action.resourceCode,
        queues: state.queues,
      })[0];
      if (!slot || slot.state !== 'open') return state;

      const approval = service.bookingMode === 'request_approval';
      const amount = computeAmount(scenario, service.key, action.resourceCode, state.paymentOn);
      const held = !approval && amount.due > 0;
      const queue: SimQueue = {
        id: `q${state.seq}`,
        queueNo: nextQueueNo(state.queues),
        serviceKey: service.key,
        resourceCode: action.resourceCode,
        date: action.date,
        time: action.time,
        durationMinutes: service.durationMinutes,
        status: approval || held ? 'pending_approval' : 'confirmed',
        customerName: action.customerName.trim() || DEMO_CUSTOMER.name,
        phone: action.phone.trim() || DEMO_CUSTOMER.phone,
        partySize: action.partySize,
        payment: amount.due > 0 ? { method: null, status: 'pending_payment', amount: amount.due } : null,
        held,
        callCount: 0,
        calledSeq: null,
        mine: true,
        seed: false,
      };
      const message = flexMessage(
        `m${state.seq + 1}`,
        bookingConfirmFlex({
          ...flexFacts(scenario, queue),
          pendingApproval: approval,
          awaitingPayment: held,
          bookingId: queue.id,
        }),
      );
      return {
        ...state,
        queues: [...state.queues, queue],
        chat: [...state.chat, message],
        seq: state.seq + 2,
        lastBookingId: queue.id,
      };
    }
    case 'pay': {
      const queue = state.queues.find((q) => q.id === action.queueId);
      if (!queue?.payment || queue.payment.status === 'paid') return state;
      const next = patch(state, action.queueId, (q) => ({
        ...q,
        payment: q.payment ? { ...q.payment, method: action.method, bank: action.bank } : q.payment,
      }));
      return settlePaid(scenario, next, action.queueId);
    }
    case 'choose_transfer': {
      const queue = state.queues.find((q) => q.id === action.queueId);
      if (!queue?.payment || queue.payment.status === 'paid') return state;
      return patch(state, action.queueId, (q) => ({
        ...q,
        payment: q.payment ? { ...q.payment, method: 'bank_transfer' } : q.payment,
      }));
    }
    case 'submit_slip': {
      const queue = state.queues.find((q) => q.id === action.queueId);
      if (!queue?.payment || queue.payment.status !== 'pending_payment') return state;
      const next = patch(state, action.queueId, (q) => ({
        ...q,
        payment: q.payment ? { ...q.payment, method: 'bank_transfer', status: 'awaiting_verification' } : q.payment,
      }));
      const message = flexMessage(
        `m${next.seq}`,
        slipReceivedFlex({ shopName: scenario.shopName, queueNumber: queue.queueNo, amountTHB: queue.payment.amount }),
      );
      return { ...next, chat: [...next.chat, message], seq: next.seq + 1 };
    }
    case 'verify_slip': {
      const queue = state.queues.find((q) => q.id === action.queueId);
      if (queue?.payment?.status !== 'awaiting_verification') return state;
      return settlePaid(scenario, state, action.queueId);
    }
    case 'staff': {
      const queue = state.queues.find((q) => q.id === action.queueId);
      if (!queue || !staffOpsFor(queue.status).includes(action.op)) return state;
      return applyStaff(scenario, state, queue, action.op);
    }
    case 'customer_text': {
      const msgs: SimChatMessage[] = [
        { id: `m${state.seq}`, role: 'customer', text: action.text },
        { id: `m${state.seq + 1}`, role: 'bot', text: action.reply },
      ];
      return { ...state, chat: [...state.chat, ...msgs], seq: state.seq + 2 };
    }
    default:
      return state;
  }
}

function applyStaff(scenario: BusinessScenario, state: SimState, queue: SimQueue, op: StaffOp): SimState {
  if (op === 'approve') {
    // Approving a queue whose slip is under review accepts the slip too.
    const slipUnderReview = queue.payment?.status === 'awaiting_verification';
    let next = patch(state, queue.id, (q) => ({ ...q, status: 'confirmed', held: false }));
    if (slipUnderReview) next = settlePaid(scenario, next, queue.id);
    const updated = next.queues.find((q) => q.id === queue.id);
    if (updated?.mine) {
      const message = flexMessage(`m${next.seq}`, bookingApprovedFlex({ ...flexFacts(scenario, updated), bookingId: updated.id }));
      next = { ...next, chat: [...next.chat, message], seq: next.seq + 1 };
    }
    return next;
  }
  if (op === 'call') {
    const callCount = queue.callCount + 1;
    let next = patch(state, queue.id, (q) => ({ ...q, status: 'called', callCount, calledSeq: state.seq }));
    next = { ...next, seq: next.seq + 1 };
    if (queue.mine) {
      const facts = flexFacts(scenario, queue);
      const message = flexMessage(
        `m${next.seq}`,
        bookingCalledFlex({
          shopName: facts.shopName,
          queueNumber: facts.queueNumber,
          branch: facts.branch,
          service: facts.service,
          assignedTo: facts.assignedTo,
          assignedLabel: facts.assignedLabel,
          callCount,
        }),
      );
      next = { ...next, chat: [...next.chat, message], seq: next.seq + 1 };
    }
    return next;
  }
  const status: SimQueue['status'] =
    op === 'serve' ? 'serving' : op === 'complete' ? 'completed' : op === 'no_show' ? 'no_show' : 'cancelled';
  return patch(state, queue.id, (q) => ({ ...q, status }));
}

/**
 * Bind a scenario to `simReduce` for `useReducer`.
 *
 * @param scenario - Business scenario.
 */
export function reducerFor(scenario: BusinessScenario) {
  return (state: SimState, action: SimAction): SimState => simReduce(scenario, state, action);
}

/**
 * Whether the visitor's booking is still waiting for money or review, used to
 * decide which hint to show.
 *
 * @param queue - The visitor's queue.
 */
export function awaitingPayment(queue: Pick<SimQueue, 'payment'> | undefined | null): boolean {
  return queue?.payment?.status === 'pending_payment';
}

/** Slot start times of a scenario's day (convenience for UI). */
export function scenarioSlotTimes(scenario: BusinessScenario): string[] {
  return buildSlotTimes(scenario.openTime, scenario.closeTime, scenario.slotMinutes);
}

/**
 * End time `HH:MM` of a queue.
 *
 * @param q - Queue.
 */
export function queueEndTime(q: Pick<SimQueue, 'time' | 'durationMinutes'>): string {
  return fromMinutes(toMinutes(q.time) + q.durationMinutes);
}
