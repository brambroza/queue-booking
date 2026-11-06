import type { PaymentMethod, PaymentStatus } from '@/types/db';
import type { ScenarioQueue } from '@/lib/demo/scenarios/types';
import type { FlexNode } from '@/lib/line/flex-canvas';

/** Statuses a sandbox queue can be in (seed statuses plus the two ways out). */
export type SimStatus = ScenarioQueue['status'] | 'cancelled' | 'no_show';

/** Payment slice of a sandbox queue. `amount` is what the customer has to pay online. */
export type SimPayment = { method: PaymentMethod | null; status: PaymentStatus; amount: number; bank?: string };

/** One queue in the in-memory shop. */
export type SimQueue = {
  id: string;
  queueNo: string;
  serviceKey: string;
  resourceCode: string | null;
  /** Bangkok date `YYYY-MM-DD`. */
  date: string;
  /** Start `HH:MM`. */
  time: string;
  durationMinutes: number;
  status: SimStatus;
  customerName: string;
  nickname?: string;
  phone: string;
  partySize?: number;
  payment: SimPayment | null;
  /** True while the queue is held `pending_approval` only because it is unpaid. */
  held: boolean;
  callCount: number;
  /** Order in which queues were called; drives "most recently called first". */
  calledSeq: number | null;
  /** Booked by the visitor in this session. */
  mine: boolean;
  /** Sample queue of the scenario: counts toward slot occupancy on every day. */
  seed: boolean;
};

/** One message in the customer's LINE chat. */
export type SimChatMessage = {
  id: string;
  role: 'customer' | 'bot';
  text?: string;
  /** Flex bubble contents (what `bookingConfirmFlex(...).contents` returns). */
  flex?: FlexNode;
  /** Plain-text description of a Flex message, for screen readers. */
  alt?: string;
};

/** Whole sandbox state. */
export type SimState = {
  paymentOn: boolean;
  /** Bangkok date the sandbox started on. */
  today: string;
  queues: SimQueue[];
  chat: SimChatMessage[];
  /** Counter used for ids and call order. */
  seq: number;
  /** Queue the visitor booked last. */
  lastBookingId: string | null;
};

/** Staff operations on the queue board. */
export type StaffOp = 'approve' | 'call' | 'serve' | 'complete' | 'no_show' | 'cancel';

/** Actions the reducer understands. */
export type SimAction =
  | {
      type: 'book';
      serviceKey: string;
      resourceCode: string | null;
      date: string;
      time: string;
      partySize?: number;
      customerName: string;
      phone: string;
      /** Current Bangkok stamp, so a slot that just passed is refused. */
      now: { date: string; time: string };
    }
  | { type: 'pay'; queueId: string; method: 'omise_promptpay' | 'omise_mobile_banking'; bank?: string }
  | { type: 'choose_transfer'; queueId: string }
  | { type: 'submit_slip'; queueId: string }
  | { type: 'verify_slip'; queueId: string }
  | { type: 'staff'; queueId: string; op: StaffOp }
  | { type: 'customer_text'; text: string; reply: string };
