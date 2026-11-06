'use client';

import { useState } from 'react';
import { Box, Button, ButtonBase, Stack, Typography } from '@mui/material';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import type { BusinessScenario } from '@/lib/demo/scenarios/types';

type Choice = { value: boolean; icon: string; title: string; text: string };

/**
 * First step: does the shop take payment online or at the counter. Picking one
 * decides whether the sandbox queue is held until paid or confirmed at once.
 *
 * @param scenario - Business scenario (for wording).
 * @param initial - Previous choice when coming back from the settings button.
 * @param onStart - Called with `true` for online payment.
 */
export function SandboxSetup({
  scenario,
  initial,
  onStart,
}: {
  scenario: BusinessScenario;
  initial: boolean | null;
  onStart: (paymentOn: boolean) => void;
}) {
  const [choice, setChoice] = useState<boolean | null>(initial);
  const options: Choice[] = [
    {
      value: true,
      icon: '💳',
      title: 'มีชำระเงินออนไลน์',
      text: `ลูกค้าจ่ายเต็มราคาตอนจอง (PromptPay, แอปธนาคาร หรือโอนแนบสลิป) คิวยืนยันเมื่อจ่ายแล้ว ราคาตั้งที่บริการหรือที่${scenario.resourceLabel}`,
    },
    {
      value: false,
      icon: '🏪',
      title: 'ไม่มีชำระเงิน (จ่ายหน้าร้าน)',
      text: 'ลูกค้าจองแล้วคิวยืนยันทันที ไม่ต้องจ่ายในแอป ร้านเก็บเงินหน้าร้านตามปกติ',
    },
  ];

  return (
    <Stack spacing={2} sx={{ p: { xs: 2, md: 3 }, border: 1, borderColor: 'divider', borderRadius: 3, bgcolor: 'background.paper' }}>
      <Box>
        <Typography variant="h6" sx={{ fontWeight: 800 }}>
          ร้านของคุณรับชำระเงินแบบไหน
        </Typography>
        <Typography variant="body2" color="text.secondary">
          เลือกแบบที่ใกล้เคียงร้านคุณ เปลี่ยนภายหลังได้
        </Typography>
      </Box>
      <Box data-tour="setup-choice" role="radiogroup" aria-label="รูปแบบการชำระเงิน" sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
        {options.map((o) => {
          const selected = choice === o.value;
          return (
            <ButtonBase
              key={String(o.value)}
              role="radio"
              data-tour={o.value ? 'setup-opt-online' : 'setup-opt-shop'}
              aria-checked={selected}
              onClick={() => setChoice(o.value)}
              sx={{
                alignItems: 'flex-start',
                textAlign: 'left',
                gap: 1.5,
                p: 2,
                borderRadius: 3,
                border: 2,
                borderColor: selected ? 'primary.main' : 'divider',
                bgcolor: selected ? 'action.selected' : 'background.paper',
              }}
            >
              <Box sx={{ fontSize: 32, lineHeight: 1 }} aria-hidden>
                {o.icon}
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontWeight: 700 }}>{o.title}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {o.text}
                </Typography>
              </Box>
              {selected ? <CheckCircleRoundedIcon color="primary" aria-hidden /> : null}
            </ButtonBase>
          );
        })}
      </Box>
      <Button data-tour={choice === null ? undefined : 'setup-start'} variant="contained" size="large" disabled={choice === null} onClick={() => choice !== null && onStart(choice)}>
        เริ่มทดลอง
      </Button>
    </Stack>
  );
}
