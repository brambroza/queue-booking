import { createTheme } from '@mui/material/styles';

export const muiTheme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#73c088' },
    background: { default: '#f6f7f9', paper: '#ffffff' },
  },
  shape: { borderRadius: 14 },
  typography: {
    fontFamily: 'var(--font-sans), sans-serif',
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          boxShadow: '0 2px 10px rgba(16,24,40,0.06)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        rounded: { borderRadius: 14 },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: { backgroundColor: '#f8fafc', fontWeight: 600 },
      },
    },
  },
});
