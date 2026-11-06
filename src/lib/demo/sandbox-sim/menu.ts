import type { RichMenuButton } from '@/lib/line/rich-menu/schema';
import type { SimQueue } from './types';

/** What a tap on a rich menu cell does in the sandbox. */
export type MenuTap =
  | { kind: 'open_booking' }
  | { kind: 'open_member' }
  | { kind: 'text'; customerText: string; botText: string };

/**
 * Decide what a rich menu tap does. Booking opens the LIFF; the member button
 * opens "my queues" (or says there is none); every other button sends its
 * label like a real tap would and gets a short canned bot reply.
 *
 * @param button - The configured button.
 * @param mine - The visitor's latest queue, if any.
 * @returns The effect.
 */
export function resolveMenuTap(button: RichMenuButton, mine: Pick<SimQueue, 'queueNo'> | null): MenuTap {
  switch (button.action.type) {
    case 'liff_booking':
      return { kind: 'open_booking' };
    case 'liff_member':
      return mine
        ? { kind: 'open_member' }
        : { kind: 'text', customerText: button.label, botText: 'ยังไม่มีคิวของคุณค่ะ กด "จองคิว" ที่เมนูเพื่อจองได้เลย' };
    case 'liff_order':
      return { kind: 'text', customerText: button.label, botText: 'เมนูสั่งอาหารเปิดเมื่อคุณมาถึงร้านและเช็คอินแล้วค่ะ' };
    case 'url':
      return { kind: 'text', customerText: button.label, botText: 'ในร้านจริง ปุ่มนี้จะเปิดลิงก์ของร้านค่ะ' };
    case 'message':
      return { kind: 'text', customerText: button.action.text, botText: 'ขอบคุณที่ติดต่อค่ะ ทีมงานจะตอบกลับโดยเร็ว' };
    default:
      return { kind: 'text', customerText: button.label, botText: 'ขอบคุณค่ะ' };
  }
}
