'use client';

import { Stack, Typography } from '@mui/material';

export function PageHeader({ title, description }: { title: string; description?: string }) {
  return (
    <Stack spacing={0.7} sx={{ mb: 2 }}>
      <Typography variant="h4" fontWeight={700}>{title}</Typography>
      {description ? <Typography variant="body2" color="text.secondary">{description}</Typography> : null}
    </Stack>
  );
}

