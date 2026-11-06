import type { SimQueue } from './types';

/** Where the visitor is looking right now. */
export type HintContext = {
  /** Which phone screen is open. */
  screen: 'chat' | 'liff';
  /** The visitor's latest booking, if any. */
  mine: Pick<SimQueue, 'status' | 'payment'> | null;
  /** Whether the "back office" is on screen next to the phone (desktop) or not. */
  boardVisible: boolean;
};

/**
 * One-line "what to tap next" guide for first-time visitors.
 *
 * @param ctx - Current screen and booking state.
 * @returns Thai instruction.
 */
export function nextHint(ctx: HintContext): string {
  const { mine, screen } = ctx;
  if (!mine) {
    return screen === 'chat'
      ? 'ขั้นต่อไป: กดเมนูจองคิวที่ด้านล่างของแชท LINE เหมือนที่ลูกค้าทำจริง'
      : 'ขั้นต่อไป: เลือกบริการ วันและเวลา แล้วกดยืนยันการจอง';
  }
  const where = ctx.boardVisible ? 'ฝั่งหลังร้าน' : 'แท็บ "หลังร้าน"';
  switch (mine.status) {
    case 'pending_approval':
      if (mine.payment?.status === 'pending_payment') return 'ขั้นต่อไป: เลือกวิธีชำระเงินในหน้าจองเพื่อให้คิวยืนยัน';
      if (mine.payment?.status === 'awaiting_verification') return `ขั้นต่อไป: ไปที่${where} กด "อนุมัติ" เพื่อรับสลิปและยืนยันคิว`;
      return `ขั้นต่อไป: ไปที่${where} แล้วกด "อนุมัติ" คิวของคุณ`;
    case 'confirmed':
    case 'checked_in':
    case 'waiting':
      return `ขั้นต่อไป: ไปที่${where} กด "เรียกคิว" แล้วดูข้อความเด้งในแชทและชื่อขึ้นจอทีวี`;
    case 'called':
      return `ขั้นต่อไป: กด "เริ่มบริการ" ที่${where} จอทีวีจะเปลี่ยนสถานะตาม`;
    case 'serving':
      return `ขั้นต่อไป: กด "เสร็จสิ้น" ที่${where} เพื่อปิดคิว`;
    default:
      return 'ครบวงจรแล้ว ลองจองอีกครั้ง หรือกด "เริ่มใหม่" เพื่อเล่นอีกรอบ แล้วสมัครใช้งานจริงได้ฟรี';
  }
}
