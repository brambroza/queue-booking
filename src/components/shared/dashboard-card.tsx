'use client';

import { Card, CardContent, Stack, Typography } from '@mui/material';

export function DashboardCard({
  label,
  value,
  color = 'text.primary',
}: {
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <Card>
      <CardContent>
        <Stack spacing={0.7}>
          <Typography variant="body2" color="text.secondary">{label}</Typography>
          <Typography variant="h4" fontWeight={700} sx={{ color }}>{value}</Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}

