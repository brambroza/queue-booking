import type { BusinessScenario, ScenarioService } from '@/lib/demo/scenarios/types';
import type { PaymentMethod } from '@/types/db';
import type { SimQueue } from './types';

/**
 * Guided tour for the public sandbox.
 *
 * Two kinds of steps:
 * - **explain** — the first time a screen appears, a short manual sequence rings
 *   each part of it ("ถัดไป" / "ข้ามคำอธิบาย"). Each sequence has a key and is
 *   shown once per visit (`explained`).
 * - **action** — rings the control to press next; moves on by itself when the
 *   visitor presses it.
 *
 * Text depends on the scenario, the chosen service (approval / rounds /
 * resource), the payment mode and the chosen payment method, and the last step
 * suggests the paths not tried yet.
 *
 * Elements carry `data-tour="<target>"`; a step lists candidate targets in
 * priority order and the overlay rings the first visible one. Controls worth
 * pressing only in some states carry the attribute only then.
 */

export type TourTarget =
  | 'setup-opt-online'
  | 'setup-opt-shop'
  | 'setup-choice'
  | 'setup-start'
  | 'area-phone'
  | 'role-customer'
  | 'role-shop'
  | 'area-board'
  | 'area-tv'
  | 'tab-customer'
  | 'tab-staff'
  | 'tab-tv'
  | 'chat-messages'
  | 'menu-all'
  | 'menu-booking'
  | 'menu-member'
  | 'liff-stepper'
  | 'liff-service'
  | 'liff-resource'
  | 'liff-party'
  | 'liff-calendar'
  | 'liff-time'
  | 'liff-form'
  | 'liff-summary'
  | 'liff-pay-note'
  | 'liff-approval-note'
  | 'liff-next'
  | 'liff-confirm'
  | 'liff-queue-no'
  | 'pay-amount'
  | 'pay-methods'
  | 'pay-qr'
  | 'pay-banks'
  | 'pay-account'
  | 'pay-action'
  | 'pay-slip'
  | 'pay-send'
  | 'pay-verify'
  | 'board-columns'
  | 'board-mine-card'
  | 'board-mine'
  | 'cta-register';

export type TourCandidate = {
  target: TourTarget;
  title: string;
  body: string;
  tips?: string[];
};

export type LiffScreen = 'service' | 'resource' | 'party' | 'datetime' | 'confirm' | 'done';
export type PayMethodChoice = 'promptpay' | 'bank_app' | 'transfer';

/** What the LIFF inside the phone is showing, reported up by the LIFF sim. */
export type LiffProgress = {
  screen: LiffScreen;
  serviceKey: string | null;
  resourceCode: string | null;
  payMethod: PayMethodChoice | null;
};

/** Paths the visitor already went through this visit, for "ลองอีกแบบ". */
export type TourHistory = {
  /** Service keys booked so far. */
  servicesBooked: string[];
  /** Payment methods that reached paid / slip sent. */
  methodsUsed: PaymentMethod[];
};

export type TourScenario = Pick<BusinessScenario, 'label' | 'shopName' | 'resourceLabel' | 'resourcePicker' | 'partySize' | 'services' | 'resources'>;

export type TourContext = {
  phase: 'setup' | 'play';
  /** Phone screen. */
  screen: 'chat' | 'liff';
  /** Side-by-side layout (desktop) or tabs (mobile). */
  desktop: boolean;
  /** Mobile tab on screen. */
  tab: 'customer' | 'staff' | 'tv';
  /** The booking the tour follows (null before the first booking or after "จองอีกแบบ"). */
  mine: Pick<SimQueue, 'status' | 'payment' | 'serviceKey'> | null;
  paymentOn: boolean;
  scenario: TourScenario;
  liff: LiffProgress | null;
  /** Explain sequences already finished or skipped. */
  explained: ReadonlySet<string>;
  /** Position inside the current explain sequence. */
  explainIndex: number;
  history: TourHistory;
};

export type TourStep = {
  /** Stable id; changes whenever the ringed part changes (drives scroll-into-view). */
  id: string;
  /** 1-based milestone for "ขั้น x/y". */
  milestone: number;
  total: number;
  candidates: TourCandidate[];
  /** Explain step: waits for "ถัดไป". */
  manual?: boolean;
  /** Key of the explain sequence this step belongs to. */
  explainKey?: string;
  /** Position / length inside the explain sequence. */
  explainPos?: { index: number; count: number };
  final?: boolean;
};

const MILESTONES_PAY = ['mode', 'intro', 'menu', 'liff', 'pay', 'staff', 'done'];
const MILESTONES_NO_PAY = ['mode', 'intro', 'menu', 'liff', 'staff', 'done'];

/** Thai baht text, "ฟรี" for 0. */
function baht(n: number): string {
  return n > 0 ? `${n.toLocaleString('th-TH')} บาท` : 'ฟรี';
}

/** True while the booking still waits for the customer to pay. */
export function owesPayment(mine: TourContext['mine']): boolean {
  return Boolean(mine?.payment && ['pending_payment', 'rejected', 'failed'].includes(mine.payment.status));
}

/** One line describing how a service is booked. */
function serviceModeTip(s: ScenarioService, resourceLabel: string): string {
  const price = s.price > 0 ? baht(s.price) : `ราคาตาม${resourceLabel}/จ่ายที่ร้าน`;
  switch (s.bookingMode) {
    case 'request_approval':
      return `"${s.name}" — ร้านต้องกดอนุมัติก่อน คิวจึงยืนยัน (${price})`;
    case 'capacity_based':
      return `"${s.name}" — รับ ${s.capacityPerSlot} คิวต่อรอบ ช่องเวลาบอกว่าเหลือกี่ที่ (${price})`;
    case 'walk_in':
      return `"${s.name}" — คิวหน้าร้าน รับได้ ${s.capacityPerSlot} คิวต่อช่วง (${price})`;
    case 'flexible_duration':
      return `"${s.name}" — ใช้เวลานาน ระบบกันเวลาของ${resourceLabel}ไว้ตามความยาวงาน (${price})`;
    default:
      return `"${s.name}" — นัดเวลาแน่นอน ${s.durationMinutes} นาที ช่องละ ${s.capacityPerSlot} คิว (${price})`;
  }
}

/** Customer-side candidates; on mobile the visitor is first sent to the LINE tab. */
function customerSide(ctx: TourContext, candidates: TourCandidate[]): TourCandidate[] {
  if (ctx.desktop || ctx.tab === 'customer') return candidates;
  return [
    {
      target: 'tab-customer',
      title: 'กลับไปที่มือถือลูกค้า',
      body: 'กดแท็บ "ลูกค้า" เพื่อทำต่อในฝั่งลูกค้า',
    },
  ];
}

/** Staff-side candidates; on mobile the visitor is first sent to the back-office tab. */
function staffSide(ctx: TourContext, candidate: TourCandidate): TourCandidate[] {
  if (ctx.desktop || ctx.tab === 'staff') return [candidate];
  return [
    {
      target: 'tab-staff',
      title: 'สลับไปเป็นพนักงานร้าน',
      body: 'กดแท็บ "ร้าน (แอดมิน)" เพื่อดูคิวของคุณในบอร์ดของร้าน',
    },
  ];
}

/** Board part: the card itself on desktop, the tab on mobile. */
function boardPart(ctx: TourContext, title: string, body: string, tips?: string[]): TourCandidate {
  return ctx.desktop || ctx.tab === 'staff'
    ? { target: 'board-mine-card', title, body, tips }
    : {
        target: 'tab-staff',
        title,
        body: `${body} (ดูได้ในแท็บ "ร้าน (แอดมิน)")`,
        tips,
      };
}

/** TV part: the board on desktop, the tab on mobile. */
function tvPart(ctx: TourContext, title: string, body: string, tips?: string[]): TourCandidate {
  return ctx.desktop || ctx.tab === 'tv' ? { target: 'area-tv', title, body, tips } : { target: 'tab-tv', title, body: `${body} (ดูได้ในแท็บ "จอหน้าร้าน")`, tips };
}

type Explain = { key: string; parts: TourCandidate[] };

/**
 * The explain sequence for what is on screen now, or null when none applies.
 * Keys that depend on a mode carry it (e.g. `pay-transfer`), so a second path
 * gets its own explanation.
 */
export function explainFor(ctx: TourContext): Explain | null {
  const { scenario: sc, mine, liff } = ctx;

  if (ctx.phase === 'setup') {
    return {
      key: 'setup',
      parts: [
        {
          target: 'setup-opt-online',
          title: 'แบบที่ 1: เก็บเงินตอนจอง',
          body: 'ลูกค้าจ่ายเต็มราคาบริการ (หรือราคา' + sc.resourceLabel + ') ตอนจองใน LINE คิวยืนยันเมื่อจ่ายแล้ว',
          tips: [
            'จ่ายได้ 3 ทาง: สแกน QR PromptPay, เด้งเข้าแอปธนาคาร, โอนแล้วแนบสลิป',
            'ไม่จ่ายภายในเวลาที่ร้านตั้ง ระบบยกเลิกคิวให้เอง ช่วยลดจองแล้วไม่มา',
            'บริการราคา 0 บาทจะข้ามขั้นจ่ายเงิน',
          ],
        },
        {
          target: 'setup-opt-shop',
          title: 'แบบที่ 2: จ่ายที่หน้าร้าน',
          body: 'ลูกค้าจองแล้วได้คิวทันที ร้านเก็บเงินตามปกติเมื่อลูกค้ามาถึง',
          tips: ['เหมาะกับร้านที่ลูกค้าประจำเยอะ หรือราคาขึ้นกับงานจริง', 'เลือกแบบนี้แล้วลองแบบแรกทีหลังได้ด้วยปุ่ม "เปลี่ยนโหมดชำระเงิน"'],
        },
      ],
    };
  }

  if (!ctx.explained.has('intro')) {
    const parts: TourCandidate[] = [
      {
        target: ctx.desktop ? 'role-customer' : 'area-phone',
        title: 'ฝั่งลูกค้า (กรอบสีเขียว)',
        body: `มือถือที่ลูกค้าใช้จอง: หน้าจอ LINE OA ของ${sc.shopName} แบบที่ลูกค้าเห็นจริง คุณจะเล่นเป็นลูกค้าก่อน`,
        tips: ['ไม่ต้องโหลดแอป ลูกค้าใช้ LINE ที่มีอยู่แล้ว', 'ไม่มีข้อความถูกส่งจริง ทุกอย่างจำลองในเบราว์เซอร์นี้'],
      },
      {
        target: 'chat-messages',
        title: 'แชทกับร้าน',
        body: 'ตัวอย่างคำถามที่ลูกค้าพิมพ์มา และบอทตอบให้อัตโนมัติ การ์ดยืนยันคิวและข้อความเรียกคิวจะเด้งเข้ามาตรงนี้',
      },
      {
        target: 'menu-all',
        title: 'Rich Menu ของร้าน',
        body: `เมนูปุ่มใหญ่ด้านล่างแชท ร้านสร้างเองได้จากหน้า Rich Menu Builder ตามประเภท${sc.label}`,
        tips: ['ปุ่มจองคิว: เปิดหน้าจองในแอป LINE', 'ปุ่มคิวของฉัน: ดูคิว จ่ายเงิน หรือยกเลิกเอง', 'ปุ่มอื่น ๆ: ราคา โปรโมชั่น แผนที่ ติดต่อร้าน'],
      },
    ];
    if (ctx.desktop) {
      parts.push(
        {
          target: 'role-shop',
          title: 'ฝั่งร้าน / แอดมิน (กรอบสีน้ำเงิน)',
          body: 'หน้าหลังบ้านที่เจ้าของร้านและพนักงานใช้ ลูกค้าไม่เห็นส่วนนี้ ทุกอย่างที่ลูกค้าทำทางซ้ายจะขึ้นที่นี่ทันที',
          tips: ['บอร์ดคิว: พนักงานจัดการคิว', 'จอหน้าร้าน (กรอบสีส้ม): ร้านเปิดบนทีวีให้ลูกค้าที่ร้านดู'],
        },
        {
          target: 'board-columns',
          title: 'บอร์ดคิวหลังร้าน',
          body: 'พนักงานเห็นทุกคิวแยกตามสถานะ: รอยืนยัน → รอเรียก → เรียกแล้ว → กำลังบริการ → เสร็จ',
          tips: ['ป้ายสีบอกสถานะคิว ป้ายขอบบอกสถานะการจ่ายเงิน', 'ปุ่มบนการ์ดเปลี่ยนตามสถานะ เช่น อนุมัติ เรียกคิว เริ่มบริการ เสร็จสิ้น'],
        },
        {
          target: 'area-tv',
          title: 'จอหน้าร้าน (กรอบสีส้ม)',
          body: 'เปิดผ่านเบราว์เซอร์บนทีวีที่ร้านมีอยู่ เลขคิวที่กำลังเรียกและคิวถัดไปเปลี่ยนตามที่พนักงานกด',
          tips: ['มี 11 รูปแบบให้เลือก ตัวอย่างนี้ใช้แบบที่เหมาะกับ' + sc.label, 'ชื่อลูกค้าบนจอแสดงแบบปิดบังบางส่วน หรือใช้ชื่อเล่นที่ลูกค้าตั้งเอง'],
        },
      );
    } else {
      parts.push(
        {
          target: 'tab-staff',
          title: 'แท็บร้าน (แอดมิน)',
          body: 'บอร์ดคิวของพนักงาน ใช้เมื่อถึงขั้นจัดการคิว ทัวร์จะบอกเองว่าเมื่อไรต้องสลับมา',
        },
        {
          target: 'tab-tv',
          title: 'แท็บจอหน้าร้าน',
          body: 'จอแสดงคิวหน้าร้าน เปลี่ยนตามที่พนักงานกดเรียกคิว',
        },
      );
    }
    return { key: 'intro', parts };
  }

  if (!mine && ctx.screen === 'liff' && liff) {
    const service = sc.services.find((s) => s.key === liff.serviceKey) ?? null;
    switch (liff.screen) {
      case 'service':
        return {
          key: 'liff-service',
          parts: [
            {
              target: 'liff-stepper',
              title: 'หน้าจอง (LIFF) เปิดใน LINE',
              body: 'จอง 2 ขั้น: เลือกบริการ แล้วเลือกวันเวลา แถบนี้บอกว่าอยู่ขั้นไหน',
            },
            {
              target: 'liff-service',
              title: 'รายการบริการของร้าน',
              body: 'ชื่อ ราคา และเวลาที่เห็นคือที่ร้านตั้งไว้ในหลังบ้าน แต่ละบริการตั้งรูปแบบการจองต่างกันได้',
              tips: sc.services.slice(0, 4).map((s) => serviceModeTip(s, sc.resourceLabel)),
            },
          ],
        };
      case 'resource': {
        const priced = sc.resources.filter((r) => r.unitPrice);
        const tips = [
          sc.resourcePicker === 'required' ? `ร้านนี้บังคับเลือก${sc.resourceLabel} ไม่มีตัวเลือก "ไม่ระบุ"` : `ไม่อยากเลือก กด "ไม่ระบุ" ให้ร้านจัดให้ได้`,
          `แสดงเฉพาะ${sc.resourceLabel}ที่ให้บริการ "${service?.name ?? ''}" ได้ (ร้านผูกไว้ในหลังบ้าน)`,
          ...(priced.length ? [`ราคาต่อ${sc.resourceLabel}ต่อรอบ เช่น ${priced[0].name} ${baht(priced[0].unitPrice ?? 0)}`] : []),
          'ร้านใส่รูปของแต่ละจุดให้ลูกค้าดูก่อนเลือกได้',
        ];
        return {
          key: `liff-resource-${sc.resourcePicker}`,
          parts: [
            {
              target: 'liff-resource',
              title: `เลือก${sc.resourceLabel}`,
              body: `ลูกค้าเลือก${sc.resourceLabel}ที่ต้องการได้เอง ระบบนับคิวแยกตาม${sc.resourceLabel} จึงไม่จองซ้อน`,
              tips,
            },
          ],
        };
      }
      case 'party':
        return sc.partySize
          ? {
              key: 'liff-party',
              parts: [
                {
                  target: 'liff-party',
                  title: sc.partySize.label,
                  body: `ลูกค้าใส่จำนวน ${sc.partySize.min}–${sc.partySize.max} ร้านเห็นในบอร์ดและเตรียมที่ได้ถูก`,
                  tips: ['ราคาไม่คูณตามจำนวนคน ราคาที่จ่ายคือราคาต่อการจอง 1 ครั้ง'],
                },
              ],
            }
          : null;
      case 'datetime': {
        const rounds = service?.bookingMode === 'capacity_based';
        const tips = ['ช่องปกติ = ว่าง แตะเลือกได้', 'ช่องสีเทา "เต็ม N/N" = รอบนั้นเต็มแล้ว', 'ช่องเส้นประ = เลยเวลาแล้ว (เวลาไทย)'];
        if (service?.bookingMode === 'capacity_based') tips.push(`บริการนี้รับ ${service.capacityPerSlot} คิวต่อรอบ ช่องที่ใกล้เต็มจะขึ้น "เหลือ N"`);
        if (liff.resourceCode) tips.push(`ช่องว่าง/เต็มนับเฉพาะ${sc.resourceLabel}ที่คุณเลือก`);
        return {
          key: rounds ? 'liff-datetime-rounds' : 'liff-datetime',
          parts: [
            ...(ctx.explained.has('liff-datetime') || ctx.explained.has('liff-datetime-rounds')
              ? []
              : [
                  {
                    target: 'liff-calendar' as const,
                    title: 'ปฏิทินแสดงเฉพาะวันที่จองได้',
                    body: 'วันที่ร้านปิด วันหยุด หรือเกินระยะที่ร้านเปิดให้จองล่วงหน้า จะไม่ขึ้นให้เลือก ลูกค้าจึงไม่งง',
                  },
                ]),
            {
              target: 'liff-time',
              title: 'ช่องเวลา',
              body: 'ทุกช่องแสดงให้เห็น แต่กดได้เฉพาะช่องที่ยังว่าง',
              tips,
            },
          ],
        };
      }
      case 'confirm': {
        const seenConfirm = Array.from(ctx.explained).some((k) => k.startsWith('liff-confirm'));
        const all: TourCandidate[] = [
          {
            target: 'liff-form',
            title: 'ข้อมูลผู้จอง',
            body: 'ระบบเติมชื่อและเบอร์ให้จากคิวก่อนหน้า ลูกค้าแก้ได้ ร้านใช้ติดต่อกลับ',
          },
          {
            target: 'liff-summary',
            title: 'สรุปก่อนยืนยัน',
            body: 'ลูกค้าตรวจบริการ วัน เวลา และราคาอีกครั้งก่อนกดยืนยัน',
          },
          {
            target: 'liff-pay-note',
            title: 'ต้องจ่ายตอนจอง',
            body: 'บริการนี้มีราคา และร้านเปิดรับชำระออนไลน์ หลังกดยืนยันจะไปหน้าจ่ายเงิน คิวยืนยันเมื่อจ่ายแล้ว',
          },
          {
            target: 'liff-approval-note',
            title: 'บริการนี้ร้านต้องอนุมัติ',
            body: 'จองแล้วคิวขึ้น "รอร้านยืนยัน" พนักงานกดอนุมัติที่หลังร้าน ลูกค้าได้ข้อความ "ร้านยืนยันคิว" ทาง LINE',
          },
        ];
        const parts = all.filter((p) => !seenConfirm || p.target === 'liff-pay-note' || p.target === 'liff-approval-note');
        return {
          key: `liff-confirm-${service?.bookingMode ?? 'x'}-${ctx.paymentOn && (service?.price ?? 0) > 0 ? 'pay' : 'free'}`,
          parts,
        };
      }
      default:
        return null;
    }
  }

  if (!mine) return null;

  if (owesPayment(mine) && ctx.screen === 'liff') {
    const method = liff?.payMethod ?? null;
    if (!method) {
      return {
        key: 'booked-unpaid',
        parts: [
          {
            target: 'liff-queue-no',
            title: 'ได้เลขคิวแล้ว แต่รอชำระเงิน',
            body: 'ระบบจองที่ให้คุณแล้ว คิวจะยืนยันเมื่อจ่ายเงิน ไม่จ่ายตามเวลาที่ร้านตั้ง ระบบยกเลิกคิวและเปิดช่องให้คนอื่น',
          },
          boardPart(ctx, 'คิวโผล่ในบอร์ดร้านทันที', 'พนักงานเห็นคิวของคุณพร้อมป้าย "รอชำระเงิน"'),
          {
            target: 'pay-amount',
            title: 'ยอดที่ต้องจ่าย',
            body: 'ราคาบริการ หรือราคา' + sc.resourceLabel + ' ต่อการจอง 1 ครั้ง',
          },
          {
            target: 'pay-methods',
            title: '3 วิธีจ่าย',
            body: 'ร้านเลือกเปิดได้ว่าจะรับแบบไหน',
            tips: [
              'QR PromptPay: จ่ายแล้วยืนยันอัตโนมัติ (ผ่าน Omise)',
              'แอปธนาคาร: เด้งเข้าแอป ยอดล็อกไว้ ใส่ PIN แล้วจบ',
              'โอน + สลิป: ระบบอ่าน QR บนสลิปและเตือนสลิปซ้ำ ร้านกดอนุมัติ หรือเปิดตรวจอัตโนมัติ',
            ],
          },
        ],
      };
    }
    const byMethod: Record<PayMethodChoice, TourCandidate[]> = {
      promptpay: [
        {
          target: 'pay-qr',
          title: 'QR PromptPay',
          body: 'ลูกค้าสแกนด้วยแอปธนาคารใดก็ได้ ยอดถูกกำหนดไว้ จ่ายแล้วระบบยืนยันคิวให้ทันที ไม่ต้องรอร้านตรวจ',
          tips: ['QR ในเดโมนี้เป็นของปลอม สแกนจ่ายจริงไม่ได้'],
        },
      ],
      bank_app: [
        {
          target: 'pay-banks',
          title: 'จ่ายผ่านแอปธนาคาร',
          body: 'เลือกธนาคาร ระบบเปิดแอปพร้อมยอดที่ล็อกไว้ ลูกค้าใส่ PIN แล้วกลับมาที่ LINE คิวยืนยันอัตโนมัติ',
          tips: ['รองรับ 5 ธนาคาร ใช้ได้บนมือถือเท่านั้น'],
        },
      ],
      transfer: [
        {
          target: 'pay-account',
          title: 'โอนเข้าบัญชีร้าน',
          body: 'ลูกค้าเห็นบัญชีหรือ QR พร้อมเพย์ของร้านเอง เงินเข้าบัญชีร้านตรง',
        },
        {
          target: 'pay-slip',
          title: 'แนบสลิป',
          body: 'ลูกค้าแนบรูปสลิป ระบบอ่าน QR บนสลิป เตือนถ้าเป็นสลิปซ้ำ แล้วส่งให้ร้านตรวจ',
          tips: ['ในเดโมไม่มีการอัปโหลดรูปจริง'],
        },
      ],
    };
    return { key: `pay-${method}`, parts: byMethod[method] };
  }

  if (mine.payment?.status === 'awaiting_verification') {
    return {
      key: 'slip-sent',
      parts: [
        {
          target: 'pay-verify',
          title: 'สลิปถึงร้านแล้ว',
          body: 'ปุ่มนี้จำลองการตรวจสลิปอัตโนมัติกับธนาคาร (ร้านที่เปิดใช้) หรือข้ามไปให้พนักงานกดอนุมัติที่หลังร้านก็ได้',
        },
        boardPart(ctx, 'ร้านเห็นป้าย "รอร้านตรวจสอบสลิป"', 'พนักงานดูสลิปแล้วกด "อนุมัติสลิป" คิวยืนยันและลูกค้าได้ใบเสร็จทาง LINE'),
      ],
    };
  }

  if (mine.payment?.status === 'paid' && ['confirmed', 'checked_in', 'waiting'].includes(mine.status)) {
    return {
      key: 'paid',
      parts: [boardPart(ctx, 'จ่ายแล้ว คิวยืนยัน', 'ป้ายในบอร์ดเปลี่ยนเป็น "ชำระแล้ว" อัตโนมัติ ลูกค้าได้ใบเสร็จเป็นการ์ดใน LINE', ['ปิดหน้าจอง (✕) เพื่อดูการ์ดใบเสร็จในแชท'])],
    };
  }

  if (mine.status === 'pending_approval') {
    return {
      key: 'approval',
      parts: [
        boardPart(ctx, 'คิวรอร้านยืนยัน', 'บริการนี้ร้านต้องดูความพร้อมก่อน (เช่น คิวช่าง/แพทย์) คิวอยู่ในคอลัมน์ "รอยืนยัน"', [
          'อนุมัติ: ลูกค้าได้ข้อความ "ร้านยืนยันคิว"',
          'ปฏิเสธ: คิวถูกยกเลิก ลูกค้าได้ข้อความแจ้ง',
        ]),
      ],
    };
  }

  if (mine.status === 'confirmed' && !mine.payment) {
    return {
      key: 'booked-free',
      parts: [
        boardPart(ctx, 'คิวโผล่ในบอร์ดร้านทันที', 'คิวยืนยันแล้ว อยู่คอลัมน์ "รอเรียก" ลูกค้าได้การ์ดยืนยันพร้อมเลขคิวใน LINE', [
          'ลูกค้ายกเลิกเองได้จากปุ่มบนการ์ด',
          'ร้านตั้งให้ส่ง LINE เตือนก่อนถึงคิวได้ 15 นาที – 1 วัน',
        ]),
      ],
    };
  }

  if (mine.status === 'called') {
    return {
      key: 'called',
      parts: [
        tvPart(ctx, 'เลขคิวขึ้นจอทีวีแล้ว', 'จอหน้าร้านแสดงคิวที่กำลังเรียกตัวใหญ่ พร้อมจุดให้บริการ', [
          'พร้อมกันนั้นลูกค้าได้ข้อความ "ถึงคิวของคุณแล้ว" ใน LINE',
          'กด "เรียกซ้ำ" ได้ถ้าลูกค้ายังไม่มา',
        ]),
        // Only point at the chat when the phone is on screen; on another mobile tab the TV tip above covers it.
        ...(ctx.desktop || ctx.tab === 'customer'
          ? [
              {
                target: 'chat-messages' as const,
                title: 'ข้อความเรียกคิวในแชท',
                body: 'การ์ด "ถึงคิวของคุณแล้ว" เด้งเข้าแชทลูกค้า (ถ้าหน้าจองยังเปิดอยู่ กด ✕ เพื่อดู)',
              },
            ]
          : []),
      ],
    };
  }

  if (mine.status === 'completed') {
    return {
      key: 'completed',
      parts: [
        tvPart(ctx, 'ปิดคิวแล้ว', 'จอทีวีเลื่อนไปคิวถัดไป คิวนี้ย้ายไปคอลัมน์ "เสร็จ / ปิด"', [
          'ร้านตั้งให้ส่งข้อความขอบคุณพร้อมปุ่มรีวิว Google หลังเสร็จได้',
          'คิวนี้ถูกนับในรายงานยอดคิวและชั่วโมงขายดี',
        ]),
      ],
    };
  }

  return null;
}

/** Paths not tried yet, shown on the last step. */
export function suggestions(ctx: TourContext): string[] {
  const { scenario: sc, history } = ctx;
  const out: string[] = [];
  const approval = sc.services.find((s) => s.bookingMode === 'request_approval' && !history.servicesBooked.includes(s.key));
  if (approval) out.push(`จอง "${approval.name}" — บริการที่ร้านต้องกดอนุมัติก่อน`);
  const rounds = sc.services.find((s) => s.bookingMode === 'capacity_based' && !history.servicesBooked.includes(s.key));
  if (rounds) out.push(`จอง "${rounds.name}" — รับหลายคิวต่อรอบ ดูช่อง "เหลือ N"`);
  if (ctx.paymentOn) {
    if (!history.methodsUsed.includes('bank_transfer')) out.push('จ่ายแบบ "โอนเงิน + ส่งสลิป" แล้วลองกด "อนุมัติสลิป" ที่หลังร้าน');
    if (!history.methodsUsed.includes('omise_promptpay')) out.push('จ่ายแบบ "สแกน QR PromptPay" ที่ยืนยันให้อัตโนมัติ');
    out.push('สลับเป็นโหมด "จ่ายหน้าร้าน" (ปุ่มเปลี่ยนโหมดชำระเงิน) — คิวยืนยันทันทีไม่ต้องจ่าย');
  } else {
    out.push('สลับเป็นโหมด "มีชำระเงินออนไลน์" (ปุ่มเปลี่ยนโหมดชำระเงิน) — ดูหน้าจ่ายเงิน 3 แบบ');
  }
  return out.slice(0, 4);
}

/** Every LIFF control the action step can point at, most specific first. */
function liffActions(ctx: TourContext): TourCandidate[] {
  const sc = ctx.scenario;
  return [
    {
      target: 'liff-confirm',
      title: 'กดยืนยันการจอง',
      body: 'ระบบออกเลขคิว ส่งการ์ดยืนยันเข้าแชท LINE และคิวโผล่ในบอร์ดร้านทันที',
    },
    {
      target: 'liff-next',
      title: 'กด "ถัดไป"',
      body: 'เลือกแล้ว ไปขั้นต่อไปได้เลย',
    },
    {
      target: 'liff-time',
      title: 'แตะเวลาที่ว่าง',
      body: 'เลือก 1 ช่องที่ยังว่าง',
    },
    {
      target: 'liff-resource',
      title: `แตะเลือก${sc.resourceLabel}`,
      body: sc.resourcePicker === 'required' ? `ต้องเลือก${sc.resourceLabel}ก่อนจึงกดถัดไปได้` : `เลือก${sc.resourceLabel} หรือ "ไม่ระบุ"`,
    },
    { target: 'liff-party', title: 'ใส่จำนวนแล้วกดถัดไป', body: 'กด + / −' },
    {
      target: 'liff-service',
      title: 'แตะเลือกบริการ',
      body: 'ลองบริการไหนก็ได้ ทัวร์จะอธิบายตามรูปแบบของบริการนั้น',
    },
  ];
}

/**
 * The tour step for the current sandbox state: the pending explain part if any,
 * otherwise the action to take.
 * @param ctx - Phase, layout, booking, LIFF progress and tour memory.
 */
export function tourStep(ctx: TourContext): TourStep {
  const list = ctx.paymentOn ? MILESTONES_PAY : MILESTONES_NO_PAY;
  const at = (key: string) => Math.max(1, list.indexOf(key) + 1);
  const base = { total: list.length };
  const { mine } = ctx;

  const milestoneNow = (): number => {
    if (ctx.phase === 'setup') return at('mode');
    if (!ctx.explained.has('intro')) return at('intro');
    if (!mine) return ctx.screen === 'liff' ? at('liff') : at('menu');
    if (owesPayment(mine)) return at('pay');
    if (mine.status === 'completed' || mine.status === 'cancelled' || mine.status === 'no_show') return at('done');
    return at('staff');
  };

  const explain = explainFor(ctx);
  if (explain && !ctx.explained.has(explain.key) && explain.parts.length > 0) {
    const index = Math.min(ctx.explainIndex, explain.parts.length - 1);
    return {
      ...base,
      id: `${explain.key}-${index}`,
      milestone: milestoneNow(),
      candidates: [explain.parts[index]],
      manual: true,
      explainKey: explain.key,
      explainPos: { index, count: explain.parts.length },
    };
  }

  if (ctx.phase === 'setup') {
    return {
      ...base,
      id: 'setup',
      milestone: at('mode'),
      candidates: [
        {
          target: 'setup-start',
          title: 'กด "เริ่มทดลอง"',
          body: 'เปิดมือถือลูกค้า บอร์ดหลังร้าน และจอทีวีพร้อมกัน',
        },
        {
          target: 'setup-choice',
          title: 'แตะเลือก 1 แบบ',
          body: 'เลือกแบบที่ใกล้ร้านคุณ เปลี่ยนภายหลังได้',
        },
      ],
    };
  }

  if (!mine) {
    if (ctx.screen === 'liff')
      return {
        ...base,
        id: `liff-${ctx.liff?.screen ?? ''}`,
        milestone: at('liff'),
        candidates: customerSide(ctx, liffActions(ctx)),
      };
    return {
      ...base,
      id: 'menu',
      milestone: at('menu'),
      candidates: customerSide(ctx, [
        {
          target: 'menu-booking',
          title: 'แตะเมนูจองคิว',
          body: 'ปุ่มนี้เปิดหน้าจองใน LINE เหมือนที่ลูกค้ากดจริง',
        },
      ]),
    };
  }

  if (owesPayment(mine)) {
    const pay: TourCandidate[] =
      ctx.screen === 'liff'
        ? [
            {
              target: 'pay-send',
              title: 'กด "ส่งสลิป"',
              body: 'สลิปไปถึงร้าน คิวขึ้น "รอร้านตรวจสอบสลิป"',
            },
            {
              target: 'pay-slip',
              title: 'กด "แนบสลิป"',
              body: 'ในเดโมใช้สลิปตัวอย่าง ไม่ต้องเลือกรูปจริง',
            },
            {
              target: 'pay-action',
              title: 'จ่ายเงิน (จำลอง)',
              body: 'กดเพื่อจำลองว่าลูกค้าจ่ายแล้ว ไม่มีการตัดเงินจริง',
            },
            {
              target: 'pay-methods',
              title: 'แตะเลือกวิธีจ่าย',
              body: 'ลองวิธีไหนก็ได้ ทัวร์จะอธิบายตามวิธีที่เลือก',
            },
          ]
        : [
            {
              target: 'menu-member',
              title: 'แตะ "คิวของฉัน"',
              body: 'คิวยังรอชำระเงิน เปิดคิวของฉันเพื่อกลับไปจ่าย',
            },
          ];
    return {
      ...base,
      id: `pay-${ctx.screen}-${ctx.liff?.payMethod ?? ''}`,
      milestone: at('pay'),
      candidates: customerSide(ctx, pay),
    };
  }

  const staff = (title: string, body: string): TourStep => ({
    ...base,
    id: `staff-${mine.status}-${mine.payment?.status ?? ''}-${ctx.tab}`,
    milestone: at('staff'),
    candidates: staffSide(ctx, { target: 'board-mine', title, body }),
  });

  switch (mine.status) {
    case 'pending_approval':
      return mine.payment?.status === 'awaiting_verification'
        ? staff('กด "อนุมัติสลิป"', 'ยืนยันว่าเงินเข้าแล้ว คิวจะยืนยันและลูกค้าได้ใบเสร็จทาง LINE')
        : staff('กด "อนุมัติ"', 'ยืนยันคิวให้ลูกค้า ลูกค้าได้ข้อความ "ร้านยืนยันคิว"');
    case 'confirmed':
    case 'checked_in':
    case 'waiting':
      return staff('กด "เรียกคิว"', 'ลูกค้าได้ข้อความ "ถึงคิวของคุณแล้ว" และเลขคิวขึ้นจอทีวี');
    case 'called':
      return staff('กด "เริ่มบริการ"', 'เมื่อลูกค้ามาถึงจุดให้บริการ');
    case 'serving':
      return staff('กด "เสร็จสิ้น"', 'ปิดคิวเมื่อให้บริการเสร็จ');
    default:
      return {
        ...base,
        id: 'done',
        milestone: at('done'),
        final: true,
        candidates: [
          {
            target: 'cta-register',
            title: 'ครบวงจรแล้ว 🎉',
            body: 'นี่คือทุกขั้นที่ลูกค้าและร้านใช้จริง กด "จองอีกแบบ" เพื่อลองเส้นทางอื่น หรือสมัครฟรีเพื่อใช้กับ LINE OA ของร้านคุณ',
            tips: suggestions(ctx),
          },
        ],
      };
  }
}
