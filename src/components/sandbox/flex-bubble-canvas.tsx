'use client';

import { useEffect, useRef, useState } from 'react';
import { Box } from '@mui/material';
import { ensureFontsLoaded, resolveFontStack } from '@/lib/line/rich-menu/canvas';
import { drawFlexBubble, measureFlexBubble, type FlexNode } from '@/lib/line/flex-canvas';

/**
 * A LINE Flex bubble painted on a canvas by the same renderer the customer
 * how-to image uses. The bubble itself comes from the real server builders
 * (`bookingConfirmFlex`, `bookingCalledFlex`, ...). Drawing happens in an
 * effect so the server render is just an empty box of a stable height.
 *
 * @param bubble - `contents` of a Flex message.
 * @param alt - Plain-text description for screen readers.
 */
export function FlexBubbleCanvas({ bubble, alt }: { bubble: FlexNode; alt: string }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const [width, setWidth] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const canvas = ref.current;
      if (!canvas) return;
      const stack = resolveFontStack();
      await ensureFontsLoaded(stack);
      if (cancelled) return;
      const font = (weight: number, size: number) => `${weight} ${size}px ${stack}`;
      const probe = document.createElement('canvas').getContext('2d');
      if (!probe) return;
      const size = measureFlexBubble(probe, bubble, font);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.ceil(size.width * dpr);
      canvas.height = Math.ceil(size.height * dpr);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.scale(dpr, dpr);
      drawFlexBubble(ctx, bubble, 0, 0, font);
      setWidth(size.width);
    })();
    return () => {
      cancelled = true;
    };
  }, [bubble]);

  return (
    <Box sx={{ minHeight: width ? 0 : 140, minWidth: width ? 0 : 200 }}>
      <canvas
        ref={ref}
        role="img"
        aria-label={alt}
        style={{ display: 'block', width: width ?? 0, maxWidth: '100%', height: 'auto' }}
      />
    </Box>
  );
}
