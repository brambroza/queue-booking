'use client';

import { Box, Button, Stack, Typography } from '@mui/material';
import type { DemoBooking } from '@/components/demo/line-demo-types';

export function FlexBookingSuccess({
  booking,
  onAction,
}: {
  booking: DemoBooking;
  onAction?: (action: 'my_queue' | 'cancel' | 'open_liff') => void;
}) {
  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: 380,
        overflow: 'hidden',
        borderRadius: 3,
        bgcolor: '#fff',
        border: '1px solid #d9e2ea',
      }}
    >
      <Box sx={{ bgcolor: '#73C088', px: 2, py: 1.6 }}>
        <Typography sx={{ color: '#f2fff4', fontSize: 13 }}>queue booking</Typography>
        <Typography sx={{ color: '#fff', fontSize: 32, fontWeight: 800, lineHeight: 1.05 }}>จองคิวสำเร็จ</Typography>
      </Box>
      <Stack spacing={1} sx={{ p: 2 }}>
        <Typography sx={{ fontSize: 38, fontWeight: 900, color: '#142030', lineHeight: 1 }}>เลขคิว {booking.queueNo}</Typography>
        <Typography>สาขา: {booking.branchName}</Typography>
        <Typography>บริการ: {booking.serviceName}</Typography>
        <Typography>วันที่: {booking.dateLabel}</Typography>
        <Typography>เวลา: {booking.timeLabel}</Typography>
        <Box sx={{ borderRadius: 2, bgcolor: '#f2f4f7', px: 1.6, py: 1, color: '#546171' }}>
          กรุณามาก่อนเวลาประมาณ 10 นาที
        </Box>
        <Button onClick={() => onAction?.('my_queue')} fullWidth variant="contained" sx={{ bgcolor: '#dfe3e9', color: '#2b3440', boxShadow: 'none' }}>
          ดูคิวของฉัน
        </Button>
        <Button onClick={() => onAction?.('cancel')} fullWidth variant="contained" sx={{ bgcolor: '#dfe3e9', color: '#2b3440', boxShadow: 'none' }}>
          ยกเลิกคิว
        </Button>
        <Button onClick={() => onAction?.('open_liff')} fullWidth variant="contained" sx={{ bgcolor: '#73C088', color: '#fff', boxShadow: 'none', '&:hover': { bgcolor: '#5ead77' } }}>
          เปิด LIFF อีกครั้ง
        </Button>
      </Stack>
    </Box>
  );
}
