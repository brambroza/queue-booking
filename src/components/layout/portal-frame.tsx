'use client';

import { useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  AppBar,
  Avatar,
  Box,
  Breadcrumbs,
  Container,
  Drawer,
  IconButton,
  Link as MLink,
  Stack,
  Toolbar,
  Typography,
} from '@mui/material';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import { PortalNav } from '@/components/layout/portal-nav';
import { LanguageSwitch } from '@/components/layout/language-switch';
import { ColorModeToggle } from '@/components/theme/color-mode-toggle';
import { NotificationsMenu } from '@/components/layout/notifications-menu';
import { TopbarUserMenu } from '@/components/layout/topbar-user-menu';
import { useI18n } from '@/components/i18n/i18n-provider';
import { DemoModeBanner } from '@/components/demo/demo-mode-banner';

const drawerWidth = 280;

function titleFromPath(pathname: string) {
  const parts = pathname.split('/').filter(Boolean).slice(1);
  return parts.map((p) => p.replace(/-/g, ' ').replace(/\b\w/g, (x) => x.toUpperCase()));
}

export function PortalFrame({
  children,
  logoUrl,
  shopName,
  fullName,
  email,
  appVersion,
  isSuperAdmin,
  demoModeEnabled,
}: {
  children: React.ReactNode;
  logoUrl: string | null;
  shopName?: string | null;
  fullName?: string | null;
  email?: string | null;
  appVersion: string;
  isSuperAdmin?: boolean;
  demoModeEnabled?: boolean;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const crumbs = useMemo(() => titleFromPath(pathname), [pathname]);
  const { t } = useI18n();

  const sidebar = (
    <Box sx={{ p: 2 }}>
      <Stack
        direction="row"
        spacing={1.3}
        alignItems="center"
        sx={{
          mb: 2.5,
          p: 1.2,
          borderRadius: 2.5,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(18,168,98,0.05)'),
        }}
      >
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="Shop Logo" width={38} height={38} className="rounded-[10px] object-cover" style={{ border: '1px solid var(--line)' }} />
        ) : (
          <Avatar
            variant="rounded"
            sx={{
              width: 38,
              height: 38,
              fontSize: 13,
              fontWeight: 800,
              color: '#fff',
              background: (theme) => `linear-gradient(135deg, ${theme.palette.primary.light}, ${theme.palette.primary.dark})`,
            }}
          >
            QB
          </Avatar>
        )}
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1 }}>{t('menu.portal')}</Typography>
          <Typography fontWeight={800} lineHeight={1.25} noWrap>{shopName || 'Queue Booking'}</Typography>
        </Box>
      </Stack>
      <PortalNav isSuperAdmin={isSuperAdmin} />
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar
        position="fixed"
        color="inherit"
        elevation={0}
        sx={{ borderBottom: '1px solid', borderColor: 'divider', bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(20,26,36,0.82)' : 'rgba(255,255,255,0.85)'), backdropFilter: 'blur(10px)', ml: { md: `${drawerWidth}px` }, width: { md: `calc(100% - ${drawerWidth}px)` } }}
      >
        <Toolbar sx={{ minHeight: 72 }}>
          <IconButton sx={{ display: { md: 'none' }, mr: 1 }} onClick={() => setOpen(true)}>
            <MenuRoundedIcon />
          </IconButton>
          <Box sx={{ flex: 1 }}>
            <Typography variant="caption" color="text.secondary">{t('menu.shop_selector')}</Typography>
            <Typography variant="body2" fontWeight={700}>{shopName ? `${shopName}  ` : '-'}</Typography>
            <Breadcrumbs aria-label="breadcrumb" sx={{ mt: 0.2 }}>
              <MLink underline="hover" color="inherit" href="/portal/dashboard">{t('menu.portal')}</MLink>
              {crumbs.map((c, idx) => (
                <Typography key={`${c}-${idx}`} color={idx === crumbs.length - 1 ? 'text.primary' : 'text.secondary'} variant="caption">
                  {c}
                </Typography>
              ))}
            </Breadcrumbs>
          </Box>
          <Stack direction="row" spacing={1.2} alignItems="center">
          {/*   <Button
              component={Link}
              href="/portal/demo-sandbox"
              size="small"
              variant={demoModeEnabled ? 'contained' : 'outlined'}
              startIcon={<ScienceRoundedIcon />}
              sx={{
                borderRadius: 999,
                textTransform: 'none',
                whiteSpace: 'nowrap',
                bgcolor: demoModeEnabled ? '#12a862' : undefined,
                borderColor: demoModeEnabled ? '#12a862' : undefined,
                '&:hover': { bgcolor: demoModeEnabled ? '#0a7043' : undefined, borderColor: '#12a862' },
                display: { xs: 'none', sm: 'inline-flex' },
              }}
            >
              โหมดทดลอง
            </Button> */}
            <ColorModeToggle />
            <LanguageSwitch />
            <NotificationsMenu />
            <TopbarUserMenu initialName={fullName} email={email} appVersion={appVersion} />
          </Stack>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}>
        <Drawer
          variant="temporary"
          open={open}
          onClose={() => setOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{ display: { xs: 'block', md: 'none' }, '& .MuiDrawer-paper': { width: drawerWidth } }}
        >
          {sidebar}
        </Drawer>
        <Drawer
          variant="permanent"
          open
          sx={{ display: { xs: 'none', md: 'block' }, '& .MuiDrawer-paper': { width: drawerWidth, boxSizing: 'border-box', borderRight: '1px solid', borderColor: 'divider' } }}
        >
          {sidebar}
        </Drawer>
      </Box>

      <Box component="main" sx={{ flex: 1, pt: { xs: 10, md: 11 }, pb: 4 }}>
        <Container maxWidth="xl">
          <DemoModeBanner show={demoModeEnabled} />
          {children}
        </Container>
      </Box>
    </Box>
  );
}
