'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import type { BusinessScenario } from '@/lib/demo/scenarios/types';
import { bookingButtonIndex } from '@/lib/line/customer-guide';
import { templateForBusiness } from '@/lib/line/rich-menu/templates';
import type { RichMenuButton } from '@/lib/line/rich-menu/schema';
import type { SimChatMessage } from '@/lib/demo/sandbox-sim/types';
import { FlexBubbleCanvas } from './flex-bubble-canvas';
import { RichMenuCanvas } from './rich-menu-canvas';

/** LINE's default chat wallpaper. */
const CHAT_BG = '#8cabd9';

/**
 * The customer's LINE chat with the shop: seeded messages, Flex cards pushed by
 * the sandbox, and the shop's rich menu at the bottom.
 *
 * @param scenario - Business scenario.
 * @param chat - Messages so far.
 * @param guideBooking - Ring the booking cell (first-time hint).
 * @param onMenuTap - A rich menu cell was tapped.
 */
export function LineChat({
  scenario,
  chat,
  guideBooking,
  onMenuTap,
}: {
  scenario: BusinessScenario;
  chat: SimChatMessage[];
  guideBooking: boolean;
  onMenuTap: (button: RichMenuButton) => void;
}) {
  const config = useMemo(() => templateForBusiness(scenario.type), [scenario.type]);
  const bookingIndex = useMemo(() => bookingButtonIndex(config.buttons), [config.buttons]);
  const scroller = useRef<HTMLDivElement | null>(null);

  // Keep the newest message in view without scrolling the whole page.
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight });
  }, [chat.length]);

  const initial = scenario.shopName.replace(/^ร้าน/, '').trim().charAt(0) || 'ร';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: CHAT_BG }}>
      <Stack direction="row" spacing={1.25} alignItems="center" sx={{ bgcolor: 'rgba(255,255,255,.95)', color: '#10201a', px: 2, py: 1.25, flexShrink: 0 }}>
        <Box sx={{ width: 32, height: 32, borderRadius: '50%', bgcolor: config.palette.primary, color: '#fff', display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 700 }}>
          {initial}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.2 }} noWrap>
            {scenario.shopName}
          </Typography>
          <Typography variant="caption" sx={{ color: '#4b5f56' }} noWrap>
            LINE Official Account
          </Typography>
        </Box>
      </Stack>

      <Stack ref={scroller} data-tour="chat-messages" spacing={1.25} role="log" aria-label="แชท LINE ของลูกค้า" aria-live="polite" sx={{ flex: 1, minHeight: 0, overflowY: 'auto', p: 1.5 }}>
        {chat.map((m) => {
          const mine = m.role === 'customer';
          if (m.flex) {
            return (
              <Box key={m.id} sx={{ alignSelf: 'flex-start', maxWidth: '100%' }}>
                <FlexBubbleCanvas bubble={m.flex} alt={m.alt ?? 'ข้อความจากร้าน'} />
              </Box>
            );
          }
          return (
            <Box
              key={m.id}
              sx={{
                alignSelf: mine ? 'flex-end' : 'flex-start',
                maxWidth: '82%',
                px: 1.5,
                py: 1,
                borderRadius: '16px',
                fontSize: 13,
                lineHeight: 1.5,
                color: '#10201a',
                bgcolor: mine ? '#8de08f' : '#fff',
                boxShadow: '0 1px 1px rgba(0,0,0,.08)',
                whiteSpace: 'pre-wrap',
              }}
            >
              {m.text}
            </Box>
          );
        })}
      </Stack>

      <Box sx={{ bgcolor: '#fff', flexShrink: 0 }}>
        <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', py: 0.5, color: '#4b5f56', fontWeight: 600, borderTop: '1px solid #e5e5e5' }}>
          ☰ {config.chatBarText}
        </Typography>
        <RichMenuCanvas config={config} shopName={scenario.shopName} highlightIndex={guideBooking ? bookingIndex : -1} onTap={onMenuTap} />
      </Box>
    </Box>
  );
}
