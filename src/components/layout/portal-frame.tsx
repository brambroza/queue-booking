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
      <Stack direction="row" spacing={1.2} alignItems="center" sx={{ mb: 2.5 }}>
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="Shop Logo" width={36} height={36} className="rounded-[10px] object-cover border border-slate-200" />
        ) : (
          <Avatar sx={{ bgcolor: '#73c088', color: '#0f2a1b', width: 36, height: 36, fontSize: 12, fontWeight: 800 }}>QB</Avatar>
        )}
        <Box>
          <Typography variant="caption" color="text.secondary">{t('menu.portal')}</Typography>
          <Typography fontWeight={700} lineHeight={1.2}>Queue Booking</Typography>
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
        sx={{ borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(8px)', ml: { md: `${drawerWidth}px` }, width: { md: `calc(100% - ${drawerWidth}px)` } }}
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
                bgcolor: demoModeEnabled ? '#639922' : undefined,
                borderColor: demoModeEnabled ? '#639922' : undefined,
                '&:hover': { bgcolor: demoModeEnabled ? '#3B6D11' : undefined, borderColor: '#639922' },
                display: { xs: 'none', sm: 'inline-flex' },
              }}
            >
              โหมดทดลอง
            </Button> */}
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
          sx={{ display: { xs: 'none', md: 'block' }, '& .MuiDrawer-paper': { width: drawerWidth, boxSizing: 'border-box', borderRight: '1px solid #e7ebf0' } }}
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
