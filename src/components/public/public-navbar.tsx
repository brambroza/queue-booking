import Link from 'next/link';
import { AppBar, Box, Button, Container, Stack, Toolbar, Typography } from '@mui/material';
import { LanguageSwitch } from '@/components/layout/language-switch';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';

const navs = [
  { label: 'หน้าแรก', href: '/' },
  { label: 'โหมดทดลอง', href: '/sandbox-demo' },
  { label: 'ฟีเจอร์', href: '/#features' },
  { label: 'ตัวอย่างการใช้งาน', href: '/#showcase' },
  { label: 'บทความ', href: '/blog' },
  { label: 'ราคา', href: '/#pricing' },
  { label: 'ติดต่อเรา', href: '/#contact' },
];

export function PublicNavbar() {
  return (
    <AppBar position="sticky" color="inherit" elevation={0} sx={{ borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(8px)' }}>
      <Container maxWidth="xl">
        <Toolbar disableGutters sx={{ minHeight: 72, justifyContent: 'space-between', gap: 2 }}>


          <Typography
            component={Link}
            href="/"
            color="text.primary"
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 1,
              textDecoration: 'none',
            }}
          >
            <Box
              sx={{
                width: 32,
                height: 32,
                bgcolor: '#73c088',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <CalendarMonthIcon sx={{ color: '#fff', fontSize: 20 }} />
            </Box>

            <Typography
              component="span"
              sx={{
                fontSize: 16,
                fontWeight: 700,
                color: 'text.primary',
              }}
            >
              QueueBooking LINE
            </Typography>
          </Typography>

          <Stack direction="row" spacing={0.5} sx={{ display: { xs: 'none', md: 'flex' } }}>
            {navs.map((n) => {
              const isDemo = n.href === '/sandbox-demo';
              return (
                <Button
                  key={n.href}
                  component={Link}
                  href={n.href}
                  color="inherit"
                  sx={
                    isDemo
                      ? {
                          bgcolor: '#EAF7EF',
                          color: '#1B5E20',
                          border: '1px solid #73C088',
                          borderRadius: 999,
                          fontWeight: 700,
                          px: 1.6,
                          animation: 'demoBlink 1.4s ease-in-out infinite',
                          '@keyframes demoBlink': {
                            '0%, 100%': { boxShadow: '0 0 0 0 rgba(115, 192, 136, 0.45)' },
                            '50%': { boxShadow: '0 0 0 8px rgba(115, 192, 136, 0)' },
                          },
                          '&:hover': {
                            bgcolor: '#DDF2E5',
                            borderColor: '#5EAD77',
                          },
                        }
                      : undefined
                  }
                >
                  {n.label}
                </Button>
              );
            })}
          </Stack>

          <Box sx={{ display: 'flex', gap: 1 }}>
            <LanguageSwitch />
            <Button component={Link} href="/login" color="inherit" sx={{ display: { xs: 'none', sm: 'inline-flex' } }}>เข้าสู่ระบบ</Button>
            <Button component={Link} href="/register" variant="contained">เริ่มใช้งานฟรี</Button>
          </Box>
        </Toolbar>
      </Container>
    </AppBar>
  );
}
