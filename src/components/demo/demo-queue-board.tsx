'use client';

import { Box, Chip, Stack, Typography } from '@mui/material';
import type { DemoQueueItem, DemoQueueStatus } from '@/components/demo/line-demo-types';

const COLUMNS: Array<{ key: DemoQueueStatus; label: string }> = [
  { key: 'waiting', label: 'Waiting' },
  { key: 'called', label: 'Called' },
  { key: 'serving', label: 'Serving' },
  { key: 'completed', label: 'Completed' },
];

function statusColor(status: DemoQueueStatus) {
  if (status === 'waiting') return 'default';
  if (status === 'called') return 'warning';
  if (status === 'serving') return 'info';
  return 'success';
}

export function DemoQueueBoard({ items }: { items: DemoQueueItem[] }) {
  return (
    <Stack spacing={1.2}>
      <Typography fontWeight={800}>Demo Queue Board</Typography>
      <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', md: 'repeat(4, minmax(0,1fr))' } }}>
        {COLUMNS.map((col) => {
          const rows = items.filter((x) => x.status === col.key);
          return (
            <Box key={col.key} sx={{ border: '1px solid #dce3ea', borderRadius: 1, p: 1.2, bgcolor: '#fbfcfd', minHeight: 160 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Typography sx={{ fontWeight: 800 }}>{col.label}</Typography>
                <Chip size="small" label={rows.length} color={statusColor(col.key)} />
              </Stack>
              <Stack spacing={0.8}>
                {rows.length === 0 ? <Typography sx={{ fontSize: 12, color: '#7e8a97' }}>ไม่มีรายการ</Typography> : rows.map((row) => (
                  <Box key={row.id} sx={{ border: '1px solid #e2e8ef', borderRadius: 1, p: 1, bgcolor: '#fff' }}>
                    <Typography sx={{ fontWeight: 900, fontSize: 20, lineHeight: 1 }}>{row.queueNo}</Typography>
                    <Typography sx={{ fontSize: 13 }}>{row.serviceName}</Typography>
                    <Typography sx={{ fontSize: 12, color: '#687483' }}>{row.timeLabel} • {row.resourceName || row.branchName}</Typography>
                  </Box>
                ))}
              </Stack>
            </Box>
          );
        })}
      </Box>
    </Stack>
  );
}
