/**
 * Draws a LINE Flex bubble on a canvas so a guide image can show the real
 * message a customer gets (built by the same builder the server pushes, e.g.
 * `bookingConfirmFlex`). Covers the subset our builders use: bubble
 * header/body/footer, vertical/horizontal boxes (backgroundColor, paddingAll,
 * cornerRadius, spacing, margin), text (size, color, weight, wrap) and button
 * (primary/secondary/link). Sizes follow LINE's px values; it is a close
 * likeness, not LINE's own renderer.
 *
 * The size/spacing helpers are pure; drawing needs a browser canvas.
 */

export type FlexNode = Record<string, unknown>;

/** LINE text sizes in px. */
const TEXT_SIZES: Record<string, number> = { xxs: 11, xs: 13, sm: 14, md: 16, lg: 19, xl: 22, xxl: 29, '3xl': 35, '4xl': 48, '5xl': 74 };

/** LINE spacing / margin keywords in px. */
const SPACINGS: Record<string, number> = { none: 0, xs: 2, sm: 4, md: 8, lg: 12, xl: 16, xxl: 20 };

/** Bubble widths in px by `size`. */
const BUBBLE_WIDTHS: Record<string, number> = { nano: 120, micro: 160, deca: 220, hecto: 241, kilo: 260, mega: 300, giga: 500 };

const LINE_HEIGHT = 1.4;
const BUBBLE_RADIUS = 17;
const BUTTON_HEIGHTS: Record<string, number> = { sm: 40, md: 52 };

/** `"sm"` / `"16px"` / undefined → px for text size. */
export function flexTextSize(value: unknown): number {
  if (typeof value === 'string') {
    if (value in TEXT_SIZES) return TEXT_SIZES[value];
    const px = /^(\d+(?:\.\d+)?)px$/.exec(value);
    if (px) return Number(px[1]);
  }
  return TEXT_SIZES.md;
}

/** `"md"` / `"10px"` / undefined → px for spacing, margin and padding. */
export function flexSpace(value: unknown, fallback = 0): number {
  if (typeof value === 'string') {
    if (value in SPACINGS) return SPACINGS[value];
    const px = /^(\d+(?:\.\d+)?)px$/.exec(value);
    if (px) return Number(px[1]);
  }
  return fallback;
}

/** Bubble width in px for its `size` (LINE default is mega). */
export function flexBubbleWidth(bubble: FlexNode): number {
  const size = typeof bubble.size === 'string' ? bubble.size : 'mega';
  return BUBBLE_WIDTHS[size] ?? BUBBLE_WIDTHS.mega;
}

type Ctx = CanvasRenderingContext2D;
type Font = (weight: number, size: number) => string;

const segmenter: Intl.Segmenter | null =
  typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter('th', { granularity: 'word' }) : null;

function wrapLines(ctx: Ctx, value: string, maxWidth: number, wrap: boolean): string[] {
  if (!wrap) {
    if (ctx.measureText(value).width <= maxWidth) return [value];
    let cut = value;
    while (cut && ctx.measureText(`${cut}…`).width > maxWidth) cut = cut.slice(0, -1);
    return [`${cut}…`];
  }
  const pieces = segmenter ? Array.from(segmenter.segment(value), (s) => s.segment) : Array.from(value);
  const lines: string[] = [];
  let current = '';
  for (const piece of pieces) {
    if (!current || ctx.measureText(current + piece).width <= maxWidth) current += piece;
    else {
      lines.push(current.trimEnd());
      current = piece.trimStart();
    }
  }
  if (current) lines.push(current);
  return lines;
}

function roundedRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function children(node: FlexNode): FlexNode[] {
  return Array.isArray(node.contents) ? (node.contents as FlexNode[]) : [];
}

function textFont(node: FlexNode, font: Font): string {
  return font(node.weight === 'bold' ? 700 : 400, flexTextSize(node.size));
}

function buttonLabel(node: FlexNode): string {
  const action = (node.action ?? {}) as { label?: unknown };
  return typeof action.label === 'string' ? action.label : '';
}

/** Height of `node` laid out at `width`. */
function measure(ctx: Ctx, node: FlexNode, width: number, font: Font): number {
  switch (node.type) {
    case 'text': {
      ctx.font = textFont(node, font);
      const lines = wrapLines(ctx, String(node.text ?? ''), width, node.wrap === true);
      return lines.length * flexTextSize(node.size) * LINE_HEIGHT;
    }
    case 'button':
      return BUTTON_HEIGHTS[String(node.height)] ?? BUTTON_HEIGHTS.md;
    case 'separator':
      return 1;
    case 'filler':
    case 'spacer':
      return flexSpace(node.size, 0);
    case 'box': {
      const pad = flexSpace(node.paddingAll, 0);
      const inner = width - pad * 2;
      const items = children(node);
      if (node.layout === 'horizontal' || node.layout === 'baseline') {
        const each = items.length ? (inner - flexSpace(node.spacing) * (items.length - 1)) / items.length : 0;
        return Math.max(0, ...items.map((c) => measure(ctx, c, each, font))) + pad * 2;
      }
      let h = 0;
      items.forEach((c, i) => {
        if (i > 0) h += c.margin !== undefined ? flexSpace(c.margin) : flexSpace(node.spacing);
        h += measure(ctx, c, inner, font);
      });
      return h + pad * 2;
    }
    default:
      return 0;
  }
}

/** Paint `node` at (x, y) with `width`. */
function paint(ctx: Ctx, node: FlexNode, x: number, y: number, width: number, font: Font): void {
  const height = measure(ctx, node, width, font);
  switch (node.type) {
    case 'text': {
      const size = flexTextSize(node.size);
      ctx.font = textFont(node, font);
      ctx.fillStyle = typeof node.color === 'string' ? node.color : '#111111';
      ctx.textBaseline = 'middle';
      const align = node.align === 'center' ? 'center' : node.align === 'end' ? 'right' : 'left';
      ctx.textAlign = align;
      const ax = align === 'center' ? x + width / 2 : align === 'right' ? x + width : x;
      wrapLines(ctx, String(node.text ?? ''), width, node.wrap === true).forEach((line, i) => {
        ctx.fillText(line, ax, y + size * LINE_HEIGHT * (i + 0.5));
      });
      return;
    }
    case 'button': {
      const style = node.style === 'primary' ? 'primary' : node.style === 'secondary' ? 'secondary' : 'link';
      const color = typeof node.color === 'string' ? node.color : null;
      if (style !== 'link') {
        ctx.fillStyle = style === 'primary' ? (color ?? '#17c950') : (color ?? '#dcdfe5');
        roundedRect(ctx, x, y, width, height, 6);
        ctx.fill();
      }
      ctx.fillStyle = style === 'primary' ? '#ffffff' : style === 'secondary' ? '#111111' : (color ?? '#42659a');
      ctx.font = font(style === 'link' ? 400 : 500, 15);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(buttonLabel(node), x + width / 2, y + height / 2 + 1);
      return;
    }
    case 'separator':
      ctx.fillStyle = typeof node.color === 'string' ? node.color : '#e5e7eb';
      ctx.fillRect(x, y, width, 1);
      return;
    case 'box': {
      if (typeof node.backgroundColor === 'string') {
        ctx.fillStyle = node.backgroundColor;
        roundedRect(ctx, x, y, width, height, flexSpace(node.cornerRadius, 0));
        ctx.fill();
      }
      const pad = flexSpace(node.paddingAll, 0);
      const inner = width - pad * 2;
      const items = children(node);
      if (node.layout === 'horizontal' || node.layout === 'baseline') {
        const gap = flexSpace(node.spacing);
        const each = items.length ? (inner - gap * (items.length - 1)) / items.length : 0;
        items.forEach((c, i) => paint(ctx, c, x + pad + i * (each + gap), y + pad, each, font));
        return;
      }
      let cy = y + pad;
      items.forEach((c, i) => {
        if (i > 0) cy += c.margin !== undefined ? flexSpace(c.margin) : flexSpace(node.spacing);
        paint(ctx, c, x + pad, cy, inner, font);
        cy += measure(ctx, c, inner, font);
      });
      return;
    }
    default:
  }
}

/** Default padding per bubble block, matching LINE's look. */
const BLOCK_PADDING: Record<'header' | 'body' | 'footer', number> = { header: 20, body: 20, footer: 10 };

function blocks(bubble: FlexNode): FlexNode[] {
  return (['header', 'body', 'footer'] as const)
    .filter((key) => bubble[key] && typeof bubble[key] === 'object')
    .map((key) => {
      const node = bubble[key] as FlexNode;
      // A block's own paddingAll wins; otherwise LINE's default for that block.
      return { ...node, paddingAll: node.paddingAll ?? `${BLOCK_PADDING[key]}px` };
    });
}

/**
 * Size of a bubble at its LINE width.
 *
 * @param ctx - Any 2D context (used for text measuring).
 * @param bubble - `contents` of a flex message (type `bubble`).
 */
export function measureFlexBubble(ctx: Ctx, bubble: FlexNode, font: Font): { width: number; height: number } {
  const width = flexBubbleWidth(bubble);
  const height = blocks(bubble).reduce((h, b) => h + measure(ctx, b, width, font), 0);
  return { width, height };
}

/**
 * Paint a bubble with its top-left at (x, y) in bubble px; scale with
 * `ctx.scale` before calling to draw it larger.
 */
export function drawFlexBubble(ctx: Ctx, bubble: FlexNode, x: number, y: number, font: Font): void {
  const { width, height } = measureFlexBubble(ctx, bubble, font);
  ctx.save();
  ctx.fillStyle = '#ffffff';
  roundedRect(ctx, x, y, width, height, BUBBLE_RADIUS);
  ctx.fill();
  roundedRect(ctx, x, y, width, height, BUBBLE_RADIUS);
  ctx.clip();
  let cy = y;
  for (const b of blocks(bubble)) {
    paint(ctx, b, x, cy, width, font);
    cy += measure(ctx, b, width, font);
  }
  ctx.restore();
}
