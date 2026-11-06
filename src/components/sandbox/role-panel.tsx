'use client';

import type { ReactNode } from 'react';
import { Box, Chip, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';

/** Who a part of the sandbox belongs to. */
export type SandboxRole = 'customer' | 'shop' | 'display';

/** Colour, icon and wording per role, shared by the panels and the mobile tabs. */
export const ROLE_META: Record<SandboxRole, { color: string; icon: string; tab: string; title: string; who: string; badge: string }> = {
  customer: {
    color: '#06C755',
    icon: '👤',
    tab: 'ลูกค้า',
    title: 'ฝั่งลูกค้า',
    who: 'สิ่งที่ลูกค้าเห็นในแอป LINE บนมือถือของตัวเอง',
    badge: 'มุมมองลูกค้า',
  },
  shop: {
    color: '#3B5BDB',
    icon: '🏪',
    tab: 'ร้าน (แอดมิน)',
    title: 'ฝั่งร้าน / แอดมิน',
    who: 'หน้าหลังบ้านที่เจ้าของร้านและพนักงานใช้ ลูกค้าไม่เห็นส่วนนี้',
    badge: 'มุมมองร้าน',
  },
  display: {
    color: '#E8590C',
    icon: '📺',
    tab: 'จอหน้าร้าน',
    title: 'จอหน้าร้าน',
    who: 'ร้านเปิดบนทีวีให้ลูกค้าที่หน้าร้านดู เปลี่ยนตามที่พนักงานกด',
    badge: 'ร้านควบคุม · ลูกค้าดู',
  },
};

/**
 * Framed section that says whose screen this is: a coloured border and a
 * header with icon, title, one line on who uses it, and a badge.
 *
 * @param role - Owner of the content.
 * @param children - The screen(s) of that role.
 * @param tourTarget - Optional `data-tour` value for the guided tour.
 * @param dense - Smaller header (mobile tabs, nested panels).
 */
export function RolePanel({ role, children, tourTarget, dense = false }: { role: SandboxRole; children: ReactNode; tourTarget?: string; dense?: boolean }) {
  const meta = ROLE_META[role];
  return (
    <Box
      component="section"
      aria-label={meta.title}
      data-tour={tourTarget}
      sx={{
        border: '2px solid',
        borderColor: alpha(meta.color, 0.45),
        borderRadius: 4,
        bgcolor: alpha(meta.color, 0.04),
        p: dense ? 1.25 : { xs: 1.25, md: 2 },
        minWidth: 0,
      }}
    >
      <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: dense ? 1.25 : 2 }}>
        <Box
          aria-hidden
          sx={{
            width: dense ? 34 : 42,
            height: dense ? 34 : 42,
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            fontSize: dense ? 18 : 22,
            bgcolor: alpha(meta.color, 0.14),
            flexShrink: 0,
          }}
        >
          {meta.icon}
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography component="h3" sx={{ fontWeight: 800, color: meta.color, lineHeight: 1.2, fontSize: dense ? 16 : 19 }}>
            {meta.title}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.4 }}>
            {meta.who}
          </Typography>
        </Box>
        <Chip size="small" label={meta.badge} sx={{ bgcolor: meta.color, color: '#fff', fontWeight: 700, display: { xs: dense ? 'none' : 'inline-flex', sm: 'inline-flex' } }} />
      </Stack>
      {children}
    </Box>
  );
}
