'use client';

import { useEffect, useRef, useState } from 'react';
import { Box, ButtonBase, Typography } from '@mui/material';
import { keyframes } from '@mui/material/styles';
import { ensureFontsLoaded, loadSvgImage, resolveFontStack } from '@/lib/line/rich-menu/canvas';
import { LAYOUTS } from '@/lib/line/rich-menu/layouts';
import { renderRichMenu } from '@/lib/line/rich-menu/render';
import type { RichMenuButton, RichMenuConfig } from '@/lib/line/rich-menu/schema';

/** Pre-render scale: 2500 px image drawn at 1000 px wide, sharp on a phone. */
const MENU_SCALE = 0.4;

const pulse = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(255,255,255,.9), inset 0 0 0 3px #fff; }
  70% { box-shadow: 0 0 0 10px rgba(255,255,255,0), inset 0 0 0 3px #fff; }
  100% { box-shadow: 0 0 0 0 rgba(255,255,255,0), inset 0 0 0 3px #fff; }
`;

/**
 * The shop's real rich menu: drawn by `renderRichMenu` (the code that makes the
 * image published to LINE) with a transparent button laid over every cell, the
 * way LINE tap areas work.
 *
 * @param config - Rich menu config from `templateForBusiness`.
 * @param shopName - Shop name for layouts that print it.
 * @param highlightIndex - Cell to ring with a pulse (the booking button), or -1.
 * @param onTap - Called with the tapped button.
 */
export function RichMenuCanvas({
  config,
  shopName,
  highlightIndex,
  onTap,
}: {
  config: RichMenuConfig;
  shopName: string;
  highlightIndex: number;
  onTap: (button: RichMenuButton) => void;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const [failed, setFailed] = useState(false);
  const layout = LAYOUTS[config.layout];

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const canvas = ref.current;
      if (!canvas) return;
      try {
        const fontStack = resolveFontStack();
        await ensureFontsLoaded(fontStack);
        if (cancelled) return;
        canvas.width = layout.width * MENU_SCALE;
        canvas.height = layout.height * MENU_SCALE;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('no canvas');
        await renderRichMenu(ctx, config, { scale: MENU_SCALE, fontStack, loadImage: loadSvgImage, shopName });
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [config, layout, shopName]);

  return (
    <Box data-tour="menu-all" sx={{ position: 'relative', width: '100%', aspectRatio: `${layout.width} / ${layout.height}`, bgcolor: '#fff' }}>
      {failed ? null : <canvas ref={ref} aria-hidden style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />}
      {layout.cells.map((cell, i) => {
        const button = config.buttons[i];
        if (!button) return null;
        return (
          <ButtonBase
            key={`${button.label}-${i}`}
            aria-label={button.label}
            data-tour={button.action.type === 'liff_booking' ? 'menu-booking' : button.action.type === 'liff_member' ? 'menu-member' : undefined}
            onClick={() => onTap(button)}
            sx={{
              position: 'absolute',
              left: `${(cell.x / layout.width) * 100}%`,
              top: `${(cell.y / layout.height) * 100}%`,
              width: `${(cell.width / layout.width) * 100}%`,
              height: `${(cell.height / layout.height) * 100}%`,
              borderRadius: 1,
              outlineOffset: -3,
              animation: i === highlightIndex ? `${pulse} 1.6s ease-out infinite` : undefined,
              '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
              ...(failed ? { border: '1px solid #e5e5e5', bgcolor: '#f7f8f7' } : null),
            }}
          >
            {failed ? <Typography variant="caption">{button.label}</Typography> : null}
          </ButtonBase>
        );
      })}
    </Box>
  );
}
