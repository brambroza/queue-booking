/**
 * Browser-only canvas drawing for the customer how-to image: one tall
 * picture, five steps, each a row of text on the left and a small mock
 * screen of this shop on the right. Rules and texts come from
 * `customer-guide.ts`; this file only paints.
 * Nothing here may be imported from a server route.
 */
import { hexToRgb, shade, tint } from '@/lib/line/rich-menu/colors';
import { LAYOUTS } from '@/lib/line/rich-menu/layouts';
import { loadSvgImage } from '@/lib/line/rich-menu/canvas';
import { renderRichMenu } from '@/lib/line/rich-menu/render';
import type { RichMenuConfig } from '@/lib/line/rich-menu/schema';
import {
  GUIDE_IMAGE_SIZE,
  bookingButtonIndex,
  exampleConfirmBubble,
  exampleDays,
  serviceSubtitle,
  type ExampleDay,
  type GuideService,
} from './customer-guide';
import { drawFlexBubble, measureFlexBubble } from './flex-canvas';

const INK = '#10201a';
const INK_SOFT = '#4b5f56';
const LINE_BORDER = '#dfe6e2';
const MUTED_BG = '#eef1ef';
/** LINE's default chat wallpaper, behind the example confirmation. */
const LINE_CHAT_BG = '#8cabd9';

/** Everything the drawer needs, loaded once. */
export type GuideAssets = {
  shopName: string;
  basicId: string;
  branchName: string | null;
  /** Rich menu primary color — the default theme color of the image. */
  primary: string;
  chatBarText: string;
  fontStack: string;
  qr: HTMLImageElement;
  /** Rich menu rendered at half size (1250 wide). */
  menu: HTMLCanvasElement;
  menuCells: ReadonlyArray<{ x: number; y: number; width: number; height: number }>;
  bookingIndex: number;
  bookingLabel: string;
  services: GuideService[];
  slotTimes: string[];
};

/** Rich menu pre-render scale: 2500 → 1250 px, sharp at the size it is drawn. */
const MENU_SCALE = 0.5;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('โหลดภาพ QR ไม่สำเร็จ'));
    img.src = src;
  });
}

/**
 * Render the QR and the rich menu once.
 *
 * @param input.addFriendUrl - LINE add-friend link encoded in the QR.
 * @param input.config - Rich menu config the shop saved (or the template).
 */
export async function loadGuideAssets(input: {
  shopName: string;
  basicId: string;
  branchName: string | null;
  addFriendUrl: string;
  config: RichMenuConfig;
  services: GuideService[];
  slotTimes: string[];
  fontStack: string;
}): Promise<GuideAssets> {
  const QRCode = await import('qrcode');
  const qrUrl = await QRCode.toDataURL(input.addFriendUrl, {
    width: 600,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: { dark: INK, light: '#ffffff' },
  });
  const qr = await loadImage(qrUrl);

  const layout = LAYOUTS[input.config.layout];
  const menu = document.createElement('canvas');
  menu.width = layout.width * MENU_SCALE;
  menu.height = layout.height * MENU_SCALE;
  const menuCtx = menu.getContext('2d');
  if (!menuCtx) throw new Error('เบราว์เซอร์ไม่รองรับ canvas');
  await renderRichMenu(menuCtx, input.config, {
    scale: MENU_SCALE,
    fontStack: input.fontStack,
    loadImage: loadSvgImage,
    shopName: input.shopName,
  });

  const bookingIndex = bookingButtonIndex(input.config.buttons);
  return {
    shopName: input.shopName,
    basicId: input.basicId,
    branchName: input.branchName,
    primary: input.config.palette.primary,
    chatBarText: input.config.chatBarText,
    fontStack: input.fontStack,
    qr,
    menu,
    menuCells: layout.cells,
    bookingIndex,
    bookingLabel: input.config.buttons[bookingIndex]?.label.trim() || 'จองคิว',
    services: input.services,
    slotTimes: input.slotTimes,
  };
}

/** True when white text reads on `hex` (WCAG relative luminance). */
function prefersWhiteText(hex: string): boolean {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.45;
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const segmenter: Intl.Segmenter | null =
  typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter('th', { granularity: 'word' }) : null;

/** Split into word pieces; Thai has no spaces, so fall back to characters. */
function textPieces(text: string): string[] {
  if (segmenter) return Array.from(segmenter.segment(text), (s) => s.segment);
  return Array.from(text);
}

/** Wrap `text` to `maxWidth`, at most `maxLines` lines (last one gets "…"). */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const lines: string[] = [];
  let current = '';
  let consumed = 0;
  for (const piece of textPieces(text)) {
    const next = current + piece;
    if (ctx.measureText(next).width <= maxWidth || !current) {
      current = next;
      consumed += piece.length;
      continue;
    }
    lines.push(current.trimEnd());
    if (lines.length === maxLines) break;
    current = piece.trimStart();
    consumed += piece.length;
  }
  if (lines.length < maxLines && current) lines.push(current);
  if (consumed < text.length && lines.length) {
    let last = lines[lines.length - 1];
    while (last && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
    lines[lines.length - 1] = `${last}…`;
  }
  return lines;
}

type Painter = {
  ctx: CanvasRenderingContext2D;
  a: GuideAssets;
  font: (weight: number, size: number) => string;
  /** Theme color (shop's pick, else the rich menu color). */
  primary: string;
  onPrimary: string;
  logo: CanvasImageSource | null;
};

/** Largest font size (down to `min`) at which `text` fits on one line. */
function fitFont(p: Painter, text: string, weight: number, size: number, min: number, maxWidth: number): string {
  for (let s = size; s >= min; s -= 2) {
    p.ctx.font = p.font(weight, s);
    if (p.ctx.measureText(text).width <= maxWidth) return p.ctx.font;
  }
  p.ctx.font = p.font(weight, min);
  return p.ctx.font;
}

function text(p: Painter, value: string, x: number, y: number, opts: { weight: number; size: number; color: string; align?: CanvasTextAlign; maxWidth?: number }) {
  const { ctx } = p;
  ctx.font = p.font(opts.weight, opts.size);
  ctx.fillStyle = opts.color;
  ctx.textAlign = opts.align ?? 'left';
  ctx.textBaseline = 'alphabetic';
  const shown = opts.maxWidth ? (wrapText(ctx, value, opts.maxWidth, 1)[0] ?? '') : value;
  ctx.fillText(shown, x, y);
}

function checkMark(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, fill: string, stroke: string) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = r * 0.28;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.45, cy + r * 0.02);
  ctx.lineTo(cx - r * 0.1, cy + r * 0.38);
  ctx.lineTo(cx + r * 0.48, cy - r * 0.32);
  ctx.stroke();
  ctx.lineCap = 'butt';
}

function imageSize(img: CanvasImageSource): { width: number; height: number } {
  if (img instanceof HTMLImageElement) return { width: img.naturalWidth || img.width, height: img.naturalHeight || img.height };
  if (img instanceof HTMLCanvasElement || img instanceof ImageBitmap) return { width: img.width, height: img.height };
  return { width: 1, height: 1 };
}

/** Draw `img` cover-fit inside a circle on a white disc. */
function drawCircleImage(ctx: CanvasRenderingContext2D, img: CanvasImageSource, cx: number, cy: number, r: number) {
  const { width: iw, height: ih } = imageSize(img);
  const s = Math.max((r * 2) / iw, (r * 2) / ih);
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  ctx.drawImage(img, cx - (iw * s) / 2, cy - (ih * s) / 2, iw * s, ih * s);
  ctx.restore();
}

const HEADER_TITLE = 'วิธีจองคิวผ่าน LINE ใน 5 ขั้นตอน';

/** Colored top band: logo (when picked) + shop name + guide title. */
function drawHeader(p: Painter, width: number, height: number) {
  const { ctx, a } = p;
  const grad = ctx.createLinearGradient(0, 0, width, height);
  grad.addColorStop(0, p.primary);
  grad.addColorStop(1, shade(p.primary, 0.18));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  if (!p.logo) {
    ctx.textAlign = 'center';
    ctx.fillStyle = p.onPrimary;
    fitFont(p, a.shopName, 500, 38, 26, width - 120);
    ctx.fillText(a.shopName, width / 2, 86);
    text(p, HEADER_TITLE, width / 2, 168, { weight: 700, size: 60, color: p.onPrimary, align: 'center', maxWidth: width - 80 });
    return;
  }

  const r = 68;
  const cx = 64 + r;
  const cy = height / 2;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(cx, cy, r + 6, 0, Math.PI * 2);
  ctx.fill();
  drawCircleImage(ctx, p.logo, cx, cy, r);
  const tx = cx + r + 40;
  const tw = width - tx - 50;
  ctx.textAlign = 'left';
  ctx.fillStyle = p.onPrimary;
  fitFont(p, a.shopName, 500, 38, 24, tw);
  ctx.fillText(a.shopName, tx, cy - 20);
  fitFont(p, HEADER_TITLE, 700, 52, 30, tw);
  ctx.fillText(HEADER_TITLE, tx, cy + 48);
}

type Box = { x: number; y: number; w: number; h: number };

/** Soft panel the mock screen sits on. */
function drawPanel(p: Painter, box: Box) {
  const { ctx } = p;
  ctx.fillStyle = tint(p.primary, 0.93);
  roundedRect(ctx, box.x, box.y, box.w, box.h, 28);
  ctx.fill();
}

function whiteCard(p: Painter, x: number, y: number, w: number, h: number, r = 18, border = LINE_BORDER, borderWidth = 2) {
  const { ctx } = p;
  ctx.save();
  ctx.shadowColor = 'rgba(16,32,26,.08)';
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = '#ffffff';
  roundedRect(ctx, x, y, w, h, r);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = border;
  ctx.lineWidth = borderWidth;
  roundedRect(ctx, x, y, w, h, r);
  ctx.stroke();
}

/** Step 1: QR + LINE id. */
function visualScan(p: Painter, box: Box) {
  const { ctx, a } = p;
  const size = box.h - 40;
  whiteCard(p, box.x + 20, box.y + 20, size, size, 20);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(a.qr, box.x + 32, box.y + 32, size - 24, size - 24);
  ctx.imageSmoothingEnabled = true;
  const tx = box.x + size + 44;
  const tw = box.x + box.w - tx - 16;
  text(p, 'หรือค้นหาไอดี', tx, box.y + box.h / 2 - 18, { weight: 400, size: 24, color: INK_SOFT, maxWidth: tw });
  ctx.fillStyle = shade(p.primary, 0.1);
  ctx.textAlign = 'left';
  fitFont(p, a.basicId, 700, 40, 22, tw);
  ctx.fillText(a.basicId, tx, box.y + box.h / 2 + 30);
}

/** Step 2: the shop's rich menu with the booking button ringed. */
function visualMenu(p: Painter, box: Box) {
  const { ctx, a } = p;
  const barH = 34;
  const maxW = box.w - 40;
  const maxH = box.h - 40 - barH;
  const ratio = a.menu.height / a.menu.width;
  const w = Math.min(maxW, maxH / ratio);
  const h = w * ratio;
  const x = box.x + (box.w - w) / 2;
  const y = box.y + (box.h - h - barH) / 2;

  ctx.save();
  roundedRect(ctx, x, y, w, h + barH, 16);
  ctx.clip();
  ctx.drawImage(a.menu, x, y, w, h);
  ctx.fillStyle = '#f4f6f5';
  ctx.fillRect(x, y + h, w, barH);
  ctx.restore();
  ctx.strokeStyle = LINE_BORDER;
  ctx.lineWidth = 2;
  roundedRect(ctx, x, y, w, h + barH, 16);
  ctx.stroke();
  text(p, `${a.chatBarText} ▾`, x + w / 2, y + h + 24, { weight: 500, size: 18, color: INK_SOFT, align: 'center' });

  const cell = a.menuCells[a.bookingIndex];
  if (!cell) return;
  const k = w / 2500;
  const cx = x + cell.x * k;
  const cy = y + cell.y * k;
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 6;
  roundedRect(ctx, cx + 5, cy + 5, cell.width * k - 10, cell.height * k - 10, 12);
  ctx.stroke();
  // "แตะ" tag sits on the ring's top edge so it never hides the button label.
  const tag = 'แตะ';
  ctx.font = p.font(700, 20);
  const tw = ctx.measureText(tag).width + 24;
  const tx = cx + cell.width * k - tw - 14;
  const ty = cy - 12;
  ctx.fillStyle = '#f59e0b';
  roundedRect(ctx, tx, ty, tw, 32, 16);
  ctx.fill();
  text(p, tag, tx + tw / 2, ty + 23, { weight: 700, size: 20, color: INK, align: 'center' });
}

/** Step 3: the shop's first services, the first one selected. */
function visualServices(p: Painter, box: Box) {
  const { ctx, a } = p;
  const services: GuideService[] = a.services.length ? a.services : [{ name: 'บริการของร้าน', durationMinutes: null, price: null }];
  const gap = 12;
  const rowH = Math.min(68, (box.h - 40 - gap * (services.length - 1)) / services.length);
  const totalH = rowH * services.length + gap * (services.length - 1);
  let y = box.y + (box.h - totalH) / 2;
  const x = box.x + 20;
  const w = box.w - 40;
  services.forEach((s, i) => {
    const selected = i === 0;
    whiteCard(p, x, y, w, rowH, 14, selected ? p.primary : LINE_BORDER, selected ? 4 : 2);
    const sub = serviceSubtitle(s);
    const textW = w - 90;
    if (sub) {
      text(p, s.name, x + 22, y + rowH / 2 - 4, { weight: 600, size: 24, color: INK, maxWidth: textW });
      text(p, sub, x + 22, y + rowH / 2 + 24, { weight: 400, size: 19, color: INK_SOFT, maxWidth: textW });
    } else {
      text(p, s.name, x + 22, y + rowH / 2 + 9, { weight: 600, size: 24, color: INK, maxWidth: textW });
    }
    if (selected) checkMark(ctx, x + w - 36, y + rowH / 2, 16, p.primary, p.onPrimary);
    else {
      ctx.strokeStyle = LINE_BORDER;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x + w - 36, y + rowH / 2, 15, 0, Math.PI * 2);
      ctx.stroke();
    }
    y += rowH + gap;
  });
}

/** Index of the selected date / time chip in step 4 (reused in step 5). */
const PICKED_DAY = 1;
const PICKED_TIME = 1;
/** One chip is drawn full so customers learn what grey means. */
const FULL_TIME = 3;

/** Step 4: date strip + time chips (one picked, one full). */
function visualDateTime(p: Painter, box: Box, days: ExampleDay[]) {
  const { ctx, a } = p;
  const x = box.x + 20;
  const w = box.w - 40;
  const chipGap = 10;
  const dayW = (w - chipGap * (days.length - 1)) / days.length;
  const dayH = 82;
  let y = box.y + 20;
  days.forEach((d, i) => {
    const cx = x + i * (dayW + chipGap);
    const picked = i === PICKED_DAY;
    if (picked) {
      ctx.fillStyle = p.primary;
      roundedRect(ctx, cx, y, dayW, dayH, 14);
      ctx.fill();
    } else whiteCard(p, cx, y, dayW, dayH, 14);
    const color = picked ? p.onPrimary : INK;
    text(p, d.weekday, cx + dayW / 2, y + 30, { weight: 400, size: 18, color: picked ? p.onPrimary : INK_SOFT, align: 'center' });
    text(p, d.day, cx + dayW / 2, y + 66, { weight: 700, size: 28, color, align: 'center' });
  });

  y += dayH + 18;
  const cols = 3;
  const times = a.slotTimes.slice(0, 6);
  const rows = Math.ceil(times.length / cols);
  const timeW = (w - chipGap * (cols - 1)) / cols;
  const timeH = Math.min(50, (box.y + box.h - 20 - y - chipGap * (rows - 1)) / Math.max(rows, 1));
  times.forEach((t, i) => {
    const cx = x + (i % cols) * (timeW + chipGap);
    const cy = y + Math.floor(i / cols) * (timeH + chipGap);
    if (i === PICKED_TIME) {
      ctx.fillStyle = p.primary;
      roundedRect(ctx, cx, cy, timeW, timeH, 12);
      ctx.fill();
      text(p, t, cx + timeW / 2, cy + timeH / 2 + 9, { weight: 700, size: 24, color: p.onPrimary, align: 'center' });
    } else if (i === FULL_TIME) {
      ctx.fillStyle = MUTED_BG;
      roundedRect(ctx, cx, cy, timeW, timeH, 12);
      ctx.fill();
      text(p, `${t} เต็ม`, cx + timeW / 2, cy + timeH / 2 + 8, { weight: 400, size: 20, color: '#9aa8a1', align: 'center' });
    } else {
      whiteCard(p, cx, cy, timeW, timeH, 12);
      text(p, t, cx + timeW / 2, cy + timeH / 2 + 9, { weight: 500, size: 24, color: INK, align: 'center' });
    }
  });
}

/**
 * Step 5: the real booking-confirmed Flex (same builder `/book` pushes) on a
 * LINE chat background, with the shop's avatar like an OA message.
 */
function visualConfirm(p: Painter, box: Box, days: ExampleDay[]) {
  const { ctx, a } = p;
  ctx.save();
  ctx.fillStyle = LINE_CHAT_BG;
  roundedRect(ctx, box.x, box.y, box.w, box.h, 28);
  ctx.fill();
  ctx.clip();

  const bubble = exampleConfirmBubble({
    shopName: a.shopName,
    branchName: a.branchName,
    serviceName: a.services[0]?.name ?? 'บริการของร้าน',
    dateIso: days[PICKED_DAY]?.iso ?? days[0]?.iso ?? '',
    time: a.slotTimes[PICKED_TIME] ?? a.slotTimes[0] ?? '10:00',
  });
  const size = measureFlexBubble(ctx, bubble, p.font);
  const avatarR = 26;
  const avatarX = box.x + 22 + avatarR;
  const top = box.y + 22;
  const left = avatarX + avatarR + 14;
  const scale = Math.min((box.x + box.w - 22 - left) / size.width, (box.h - 44) / size.height);

  if (p.logo) drawCircleImage(ctx, p.logo, avatarX, top + avatarR, avatarR);
  else {
    ctx.fillStyle = p.primary;
    ctx.beginPath();
    ctx.arc(avatarX, top + avatarR, avatarR, 0, Math.PI * 2);
    ctx.fill();
    text(p, Array.from(a.shopName.trim())[0] ?? 'ร', avatarX, top + avatarR + 10, { weight: 700, size: 28, color: p.onPrimary, align: 'center' });
  }

  ctx.translate(left, top);
  ctx.scale(scale, scale);
  drawFlexBubble(ctx, bubble, 0, 0, p.font);
  ctx.restore();
}

type Step = { title: string; hint: string; draw: (p: Painter, box: Box) => void };

export type GuideDrawOptions = {
  /** Theme color `#rrggbb`; defaults to the rich menu color. */
  primary?: string;
  /** Logo shown in the header and as the chat avatar. */
  logo?: CanvasImageSource | null;
  /** Clock for the example dates. */
  now?: Date;
};

/**
 * Paint the whole guide on `canvas` (resized to `GUIDE_IMAGE_SIZE`).
 *
 * @param canvas - Target canvas.
 * @param assets - Output of `loadGuideAssets`.
 * @param options - Color, logo and clock.
 */
export function drawGuideImage(canvas: HTMLCanvasElement, assets: GuideAssets, options: GuideDrawOptions = {}): void {
  const { width, height } = GUIDE_IMAGE_SIZE;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('เบราว์เซอร์ไม่รองรับ canvas');
  const primary = options.primary ?? assets.primary;
  const p: Painter = {
    ctx,
    a: assets,
    font: (w, s) => `${w} ${s}px ${assets.fontStack}`,
    primary,
    onPrimary: prefersWhiteText(primary) ? '#ffffff' : INK,
    logo: options.logo ?? null,
  };
  const days = exampleDays(options.now ?? new Date(), 5);

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  drawHeader(p, width, 220);

  const steps: Step[] = [
    { title: 'สแกน QR เพิ่มเพื่อน', hint: 'เปิดแอป LINE › เพิ่มเพื่อน › สแกน QR', draw: visualScan },
    { title: 'เข้า LINE OA เลือกเมนู', hint: `แตะปุ่ม "${assets.bookingLabel}" ที่เมนูด้านล่างห้องแชท`, draw: visualMenu },
    { title: 'เลือกบริการ', hint: 'เลือกบริการที่ต้องการ', draw: visualServices },
    { title: 'เลือกวันที่ และเวลา', hint: 'ช่องสีเทา = คิวเต็มแล้ว (วันเวลาในภาพเป็นตัวอย่าง)', draw: (pp, box) => visualDateTime(pp, box, days) },
    { title: 'ยืนยันการจอง', hint: 'รับข้อความยืนยันคิวทาง LINE ทันที', draw: (pp, box) => visualConfirm(pp, box, days) },
  ];

  // Steps 1–4 share one height; step 5 is tall enough for the real Flex card.
  const rowHeights = [262, 262, 262, 262, 550];
  const top = 240;
  const circleX = 116;
  const r = 36;
  let y0 = top;
  steps.forEach((step, i) => {
    const rowH = rowHeights[i];
    // Timeline joining the numbers.
    if (i < steps.length - 1) {
      ctx.strokeStyle = tint(primary, 0.6);
      ctx.lineWidth = 4;
      ctx.setLineDash([10, 10]);
      ctx.beginPath();
      ctx.moveTo(circleX, y0 + 30 + r * 2 + 8);
      ctx.lineTo(circleX, y0 + rowH + 30 - 8);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.fillStyle = primary;
    ctx.beginPath();
    ctx.arc(circleX, y0 + 30 + r, r, 0, Math.PI * 2);
    ctx.fill();
    text(p, String(i + 1), circleX, y0 + 30 + r + 15, { weight: 700, size: 42, color: p.onPrimary, align: 'center' });

    const tx = 176;
    const tw = 330;
    ctx.font = p.font(700, 35);
    ctx.fillStyle = INK;
    ctx.textAlign = 'left';
    const titleLines = wrapText(ctx, step.title, tw, 2);
    titleLines.forEach((line, li) => ctx.fillText(line, tx, y0 + 78 + li * 46));
    ctx.font = p.font(400, 25);
    ctx.fillStyle = INK_SOFT;
    const hintTop = y0 + 78 + titleLines.length * 46 + 4;
    wrapText(ctx, step.hint, tw, 3).forEach((line, li) => ctx.fillText(line, tx, hintTop + li * 36));

    const box: Box = { x: 520, y: y0 + 10, w: 500, h: rowH - 30 };
    drawPanel(p, box);
    step.draw(p, box);
    y0 += rowH;
  });

  ctx.fillStyle = tint(primary, 0.9);
  ctx.fillRect(0, height - 80, width, 80);
  text(p, 'จองคิวผ่าน LINE ได้ตลอด 24 ชม. ไม่ต้องโทร', width / 2, height - 30, { weight: 500, size: 28, color: INK_SOFT, align: 'center' });
}

/** Encode a painted canvas as PNG. */
export function guideCanvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('สร้างไฟล์ภาพไม่สำเร็จ'))), 'image/png');
  });
}
