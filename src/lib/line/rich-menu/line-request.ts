import { LAYOUTS } from './layouts';
import type { RichMenuConfig } from './schema';

/** Thrown when the config cannot be turned into a LINE request (e.g. missing LIFF ID). */
export class RichMenuConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RichMenuConfigError';
  }
}

export type LineRichMenuAction =
  | { type: 'uri'; label: string; uri: string }
  | { type: 'message'; label: string; text: string };

export type LineRichMenuArea = {
  bounds: { x: number; y: number; width: number; height: number };
  action: LineRichMenuAction;
};

export type LineRichMenuRequest = {
  size: { width: number; height: number };
  selected: boolean;
  name: string;
  chatBarText: string;
  areas: LineRichMenuArea[];
};

export type LiffContext = {
  liffBookingId: string | null;
  liffMemberId: string | null;
};

/** Build the `areas` array for LINE from the layout cells + button actions. */
export function buildLineAreas(config: RichMenuConfig, ctx: LiffContext): LineRichMenuArea[] {
  const layout = LAYOUTS[config.layout];
  return layout.cells.map((cell, i) => {
    const button = config.buttons[i];
    if (!button) throw new RichMenuConfigError(`ช่องที่ ${i + 1} ยังไม่มีปุ่ม`);
    return {
      bounds: { x: cell.x, y: cell.y, width: cell.width, height: cell.height },
      action: toLineAction(button.label, button.action, ctx),
    };
  });
}

function toLineAction(label: string, action: RichMenuConfig['buttons'][number]['action'], ctx: LiffContext): LineRichMenuAction {
  switch (action.type) {
    case 'liff_booking':
      if (!ctx.liffBookingId) throw new RichMenuConfigError('ยังไม่ได้ตั้งค่า LIFF ID (จองคิว) — ตั้งค่าที่ LINE Settings ก่อน');
      return { type: 'uri', label, uri: `https://liff.line.me/${ctx.liffBookingId}` };
    case 'liff_member':
      if (!ctx.liffMemberId) throw new RichMenuConfigError('ยังไม่ได้ตั้งค่า LIFF ID (สมาชิก) — ตั้งค่าที่ LINE Settings ก่อน');
      return { type: 'uri', label, uri: `https://liff.line.me/${ctx.liffMemberId}` };
    case 'url':
      return { type: 'uri', label, uri: action.url };
    case 'message':
      return { type: 'message', label, text: action.text };
    default:
      throw new RichMenuConfigError('ประเภทปุ่มไม่รองรับ');
  }
}

/** Full body for `POST https://api.line.me/v2/bot/richmenu`. */
export function buildRichMenuRequest(config: RichMenuConfig, ctx: LiffContext, name: string): LineRichMenuRequest {
  const layout = LAYOUTS[config.layout];
  return {
    size: { width: layout.width, height: layout.height },
    selected: true,
    name: name.slice(0, 300),
    chatBarText: config.chatBarText,
    areas: buildLineAreas(config, ctx),
  };
}
