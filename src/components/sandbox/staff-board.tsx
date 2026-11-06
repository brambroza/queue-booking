'use client';

import type { Dispatch } from 'react';
import { Box, Button, Chip, Stack, Typography } from '@mui/material';
import type { BusinessScenario } from '@/lib/demo/scenarios/types';
import { getStatusMeta } from '@/lib/booking/status-meta';
import { DEMO_PAYMENT_LABELS } from '@/lib/demo/payment-demo';
import { STAFF_OP_LABEL, STATUS_LABEL_TH, staffOpsFor } from '@/lib/demo/sandbox-sim/reducer';
import { formatThaiDateLabel } from '@/lib/utils/date-format';
import type { SimAction, SimQueue, SimState } from '@/lib/demo/sandbox-sim/types';

type Column = { key: string; title: string; statuses: SimQueue['status'][] };

const COLUMNS: Column[] = [
  { key: 'pending', title: 'รอยืนยัน', statuses: ['pending_approval'] },
  { key: 'waiting', title: 'รอเรียก', statuses: ['confirmed', 'checked_in', 'waiting'] },
  { key: 'called', title: 'เรียกแล้ว', statuses: ['called'] },
  { key: 'serving', title: 'กำลังบริการ', statuses: ['serving'] },
  { key: 'done', title: 'เสร็จ / ปิด', statuses: ['completed', 'cancelled', 'no_show'] },
];

/**
 * Back-office queue board, laid out like `/portal/queue-board` (one column per
 * stage, a card per queue, staff buttons per status). Built from MUI directly:
 * the real board client fetches APIs, so only its status rules are reused
 * (`getStatusMeta`, and `staffOpsFor`, a mirror of `status-flow.ts`).
 *
 * @param scenario - Business scenario.
 * @param state - Sandbox state.
 * @param dispatch - Sandbox reducer dispatch.
 */
export function StaffBoard({ scenario, state, dispatch }: { scenario: BusinessScenario; state: SimState; dispatch: Dispatch<SimAction> }) {
  const sorted = [...state.queues].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const waiting = sorted.filter((q) => ['confirmed', 'checked_in', 'waiting'].includes(q.status)).length;

  return (
    <Box>
      <Stack direction="row" alignItems="baseline" justifyContent="space-between" spacing={1} sx={{ mb: 1.5 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
          บอร์ดคิว · {scenario.branchName}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          รอเรียก {waiting} คิว
        </Typography>
      </Stack>
      <Box data-tour="board-columns" sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', xl: 'repeat(5, minmax(0, 1fr))' }, alignItems: 'start' }}>
        {COLUMNS.map((col) => {
          const items = sorted.filter((q) => col.statuses.includes(q.status));
          return (
            <Box key={col.key} component="section" aria-label={col.title} sx={{ bgcolor: 'action.hover', borderRadius: 2, p: 1, minHeight: 80 }}>
              <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', px: 0.5, pb: 0.75 }}>
                {col.title} ({items.length})
              </Typography>
              <Stack spacing={1}>
                {items.map((q) => {
                  const service = scenario.services.find((s) => s.key === q.serviceKey);
                  const resource = q.resourceCode ? scenario.resources.find((r) => r.code === q.resourceCode) : undefined;
                  const palette = getStatusMeta(q.status).palette;
                  const ops = staffOpsFor(q.status);
                  return (
                    <Box
                      key={q.id}
                      data-tour={q.id === state.lastBookingId ? 'board-mine-card' : undefined}
                      sx={{ bgcolor: 'background.paper', borderRadius: 2, p: 1.25, border: 1, borderColor: q.mine ? 'primary.main' : 'divider', boxShadow: q.mine ? 2 : 0 }}
                    >
                      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                        <Typography sx={{ fontWeight: 800 }}>{q.queueNo}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {q.date === state.today ? q.time : `${formatThaiDateLabel(q.date)} ${q.time}`}
                        </Typography>
                      </Stack>
                      <Typography variant="body2" noWrap>
                        {q.customerName}
                        {q.mine ? ' (คุณ)' : ''}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        {service?.name}
                        {resource ? ` · ${resource.name}` : ''}
                        {q.partySize ? ` · ${q.partySize} ${scenario.partySize?.label ?? 'คน'}` : ''}
                      </Typography>
                      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 0.75 }}>
                        <Chip size="small" color={palette === 'default' ? 'default' : palette} label={STATUS_LABEL_TH[q.status] ?? q.status} />
                        {q.payment ? (
                          <Chip size="small" variant="outlined" color={q.payment.status === 'paid' ? 'success' : 'warning'} label={DEMO_PAYMENT_LABELS[q.payment.status]} />
                        ) : null}
                      </Stack>
                      {ops.length > 0 ? (
                        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                          {ops.map((op, i) => (
                            <Button
                              key={op}
                              data-tour={q.id === state.lastBookingId && i === 0 ? 'board-mine' : undefined}
                              size="small"
                              variant={i === 0 ? 'contained' : 'outlined'}
                              color={op === 'no_show' || op === 'cancel' ? 'inherit' : 'primary'}
                              onClick={() => dispatch({ type: 'staff', queueId: q.id, op })}
                              aria-label={`${op === 'call' && q.status === 'called' ? 'เรียกซ้ำ' : STAFF_OP_LABEL[op]} คิว ${q.queueNo}`}
                            >
                              {op === 'call' && q.status === 'called' ? 'เรียกซ้ำ' : op === 'approve' && q.payment?.status === 'awaiting_verification' ? 'อนุมัติสลิป' : STAFF_OP_LABEL[op]}
                            </Button>
                          ))}
                        </Stack>
                      ) : null}
                    </Box>
                  );
                })}
              </Stack>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
