'use client';

import { useEffect, useRef, useState } from 'react';
import { drawFlexBubble, flexBubbleWidth, measureFlexBubble, type FlexNode } from '@/lib/line/flex-canvas';
import { ensureFontsLoaded, resolveFontStack } from '@/lib/line/rich-menu/canvas';

/**
 * Paints one LINE Flex bubble (the `contents` of a flex message built by the
 * real builders in `src/lib/line/messages*.ts`) on a canvas, so the home page
 * shows the card a customer gets rather than a hand-made imitation. When a
 * builder changes, the picture changes with it.
 *
 * @param bubble - Flex bubble node.
 * @param width - CSS width to draw at; the bubble is scaled from its LINE width.
 * @param alt - Accessible description of the card.
 */
export function FlexBubbleCanvas({ bubble, width, alt }: { bubble: FlexNode; width: number; alt: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [height, setHeight] = useState<number | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let cancelled = false;

    (async () => {
      const fontStack = resolveFontStack();
      await ensureFontsLoaded(fontStack);
      if (cancelled) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const font = (weight: number, size: number) => `${weight} ${size}px ${fontStack}`;
      const native = measureFlexBubble(ctx, bubble, font);
      const scale = width / flexBubbleWidth(bubble);
      const cssHeight = Math.ceil(native.height * scale);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(cssHeight * dpr);
      ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
      ctx.clearRect(0, 0, native.width, native.height);
      drawFlexBubble(ctx, bubble, 0, 0, font);
      setHeight(cssHeight);
    })().catch(() => {
      /* A failed draw leaves the placeholder; nothing else depends on it. */
    });

    return () => {
      cancelled = true;
    };
  }, [bubble, width]);

  return (
    <canvas
      ref={ref}
      role="img"
      aria-label={alt}
      style={{
        display: 'block',
        width,
        height: height ?? Math.round(width * 0.9),
        borderRadius: 17,
        background: height ? 'transparent' : 'rgba(255,255,255,.55)',
        maxWidth: '100%',
      }}
    />
  );
}
