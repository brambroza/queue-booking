'use client';

import { CssBaseline, ThemeProvider } from '@mui/material';
import { muiTheme } from '@/theme/mui-theme';

export function MuiAppProvider({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider theme={muiTheme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}

