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
  Tooltip,
  Typography,
} from '@mui/material';
import type { Theme } from '@mui/material/styles';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import { PortalNav } from '@/components/layout/portal-nav';
import { LanguageSwitch } from '@/components/layout/language-switch';
import { ColorModeToggle } from '@/components/theme/color-mode-toggle';
import { NotificationsMenu } from '@/components/layout/notifications-menu';
import { TopbarUserMenu } from '@/components/layout/topbar-user-menu';
import { BranchScopeProvider } from '@/components/layout/branch-scope-provider';
import { BranchSwitch } from '@/components/layout/branch-switch';
import { ShopSwitch } from '@/components/layout/shop-switch';
import {
  SIDEBAR_MINI_WIDTH,
  SIDEBAR_WIDTH,
  SidebarCollapseProvider,
  useSidebarCollapse,
} from '@/components/layout/sidebar-collapse-context';
import { useI18n } from '@/components/i18n/i18n-provider';
import { DemoModeBanner } from '@/components/demo/demo-mode-banner';
import { PortalTour } from '@/components/layout/portal-tour';
import { UpgradeProvider } from '@/components/subscription/upgrade-provider';

/** Shared width/margin transition for the desktop sidebar and app bar. */
const sidebarTransition = (theme: Theme) =>
  theme.transitions.create(['width', 'margin'], {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.enteringScreen,
  });

function titleFromPath(pathname: string) {
  const parts = pathname.split('/').filter(Boolean).slice(1);
  return parts.map((p) => p.replace(/-/g, ' ').replace(/\b\w/g, (x) => x.toUpperCase()));
}

type PortalFrameProps = {
  children: React.ReactNode;
  logoUrl: string | null;
  shopName?: string | null;
  fullName?: string | null;
  email?: string | null;
  appVersion: string;
  isSuperAdmin?: boolean;
  demoModeEnabled?: boolean;
  /** Shop the shell resolved for this request; drives the super_admin shop selector. */
  activeShopId?: string | null;
};

/**
 * Portal shell: app bar, responsive sidebar (mobile drawer / desktop
 * collapsible rail) and page container. Wraps children with the providers
 * the portal pages depend on.
 */
export function PortalFrame(props: PortalFrameProps) {
  return (
    <BranchScopeProvider>
      <SidebarCollapseProvider>
        <PortalFrameInner {...props} />
      </SidebarCollapseProvider>
    </BranchScopeProvider>
  );
}

/**
 * Sidebar content (shop header + navigation + collapse toggle).
 * `collapsed` is only ever true inside the desktop permanent drawer.
 */
function SidebarContent({
  logoUrl,
  shopName,
  isSuperAdmin,
  collapsed,
  onNavigate,
  onToggle,
  toggleLabel,
}: {
  logoUrl: string | null;
  shopName?: string | null;
  isSuperAdmin?: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
  onToggle?: () => void;
  toggleLabel?: string;
}) {
  const { t } = useI18n();

  const toggleButton = onToggle ? (
    <Tooltip title={toggleLabel ?? ''} placement="right" arrow>
      <IconButton
        size="small"
        onClick={onToggle}
        aria-label={toggleLabel}
        aria-expanded={!collapsed}
        sx={{
          width: 32,
          height: 32,
          flexShrink: 0,
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          color: 'text.secondary',
          boxShadow: (theme) => (theme.palette.mode === 'dark' ? 'none' : '0 1px 2px rgba(15,23,42,0.06)'),
          transition: (theme) =>
            theme.transitions.create(['background-color', 'color', 'border-color', 'box-shadow'], {
              duration: theme.transitions.duration.shorter,
            }),
          '&:hover': {
            bgcolor: 'primary.main',
            borderColor: 'primary.main',
            color: 'primary.contrastText',
            boxShadow: (theme) => `0 6px 16px ${theme.palette.primary.main}40`,
          },
          '& .MuiSvgIcon-root': {
            transition: (theme) => theme.transitions.create('transform', { duration: theme.transitions.duration.standard }),
            transform: collapsed ? 'rotate(180deg)' : 'rotate(0deg)',
          },
        }}
      >
        <ChevronLeftRoundedIcon fontSize="small" />
      </IconButton>
    </Tooltip>
  ) : null;

  return (
    <Box
      data-tour="portal-nav"
      sx={{ height: '100%', minHeight: 0, overflowY: 'auto', overflowX: 'hidden', p: collapsed ? 1 : 2 }}
    >
      <Stack
        direction={collapsed ? 'column' : 'row'}
        spacing={collapsed ? 1 : 1.3}
        alignItems="center"
        sx={{
          mb: collapsed ? 1.5 : 2.5,
          p: collapsed ? 0.8 : 1.2,
          borderRadius: 2.5,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(18,168,98,0.05)'),
        }}
      >
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="Shop Logo" width={38} height={38} className="rounded-[10px] object-cover" style={{ border: '1px solid var(--line)', flexShrink: 0 }} />
        ) : (
          <Avatar
            variant="rounded"
            sx={{
              width: 38,
              height: 38,
              fontSize: 13,
              fontWeight: 800,
              color: '#fff',
              flexShrink: 0,
              background: (theme) => `linear-gradient(135deg, ${theme.palette.primary.light}, ${theme.palette.primary.dark})`,
            }}
          >
            QB
          </Avatar>
        )}
        {!collapsed && (
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1 }}>{t('menu.portal')}</Typography>
            <Typography fontWeight={800} lineHeight={1.25} noWrap>{shopName || 'Queue Booking'}</Typography>
          </Box>
        )}
        {toggleButton}
      </Stack>
      <PortalNav isSuperAdmin={isSuperAdmin} collapsed={collapsed} onNavigate={onNavigate} />
    </Box>
  );
}

function PortalFrameInner({
  children,
  logoUrl,
  shopName,
  fullName,
  email,
  appVersion,
  isSuperAdmin,
  demoModeEnabled,
  activeShopId = null,
}: PortalFrameProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const crumbs = useMemo(() => titleFromPath(pathname), [pathname]);
  const { t } = useI18n();
  const { collapsed, toggle } = useSidebarCollapse();

  const desktopWidth = collapsed ? SIDEBAR_MINI_WIDTH : SIDEBAR_WIDTH;
  // Inline fallbacks: the DB dictionary replaces fallback.ts wholesale, so a
  // key not yet seeded there would otherwise surface as the raw key string.
  const toggleLabel = collapsed ? t('menu.sidebar_expand', 'ขยายเมนู') : t('menu.sidebar_collapse', 'ย่อเมนู');

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar
        position="fixed"
        color="inherit"
        elevation={0}
        sx={{
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(20,26,36,0.82)' : 'rgba(255,255,255,0.85)'),
          backdropFilter: 'blur(10px)',
          ml: { md: `${desktopWidth}px` },
          width: { md: `calc(100% - ${desktopWidth}px)` },
          transition: sidebarTransition,
        }}
      >
        <Toolbar sx={{ minHeight: 72 }}>
          <IconButton sx={{ display: { md: 'none' }, mr: 1 }} onClick={() => setOpen(true)}>
            <MenuRoundedIcon />
          </IconButton>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            {isSuperAdmin ? (
              <ShopSwitch activeShopId={activeShopId} />
            ) : (
              <>
                <Typography variant="caption" color="text.secondary">{t('menu.shop_selector')}</Typography>
                <Typography variant="body2" fontWeight={700}>{shopName ? `${shopName}  ` : '-'}</Typography>
              </>
            )}
            <Breadcrumbs aria-label="breadcrumb" sx={{ mt: 0.2 }}>
              <MLink underline="hover" color="inherit" href="/portal/dashboard">{t('menu.portal')}</MLink>
              {crumbs.map((c, idx) => (
                <Typography key={`${c}-${idx}`} color={idx === crumbs.length - 1 ? 'text.primary' : 'text.secondary'} variant="caption">
                  {c}
                </Typography>
              ))}
            </Breadcrumbs>
          </Box>
          <Stack data-tour="portal-toolbar" direction="row" spacing={1.2} alignItems="center">
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
            <BranchSwitch />
            <PortalTour />
            <ColorModeToggle />
            <LanguageSwitch />
            <NotificationsMenu />
            <TopbarUserMenu initialName={fullName} email={email} appVersion={appVersion} />
          </Stack>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { md: desktopWidth }, flexShrink: { md: 0 }, transition: sidebarTransition }}>
        <Drawer
          variant="temporary"
          open={open}
          onClose={() => setOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{ display: { xs: 'block', md: 'none' }, '& .MuiDrawer-paper': { width: SIDEBAR_WIDTH } }}
        >
          <SidebarContent
            logoUrl={logoUrl}
            shopName={shopName}
            isSuperAdmin={isSuperAdmin}
            collapsed={false}
            onNavigate={() => setOpen(false)}
          />
        </Drawer>
        <Drawer
          variant="permanent"
          open
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': {
              width: desktopWidth,
              boxSizing: 'border-box',
              overflowX: 'hidden',
              borderRight: '1px solid',
              borderColor: 'divider',
              transition: sidebarTransition,
            },
          }}
        >
          <SidebarContent
            logoUrl={logoUrl}
            shopName={shopName}
            isSuperAdmin={isSuperAdmin}
            collapsed={collapsed}
            onToggle={toggle}
            toggleLabel={toggleLabel}
          />
        </Drawer>
      </Box>

      <Box component="main" data-tour="page-content" sx={{ flex: 1, minWidth: 0, pt: { xs: 10, md: 11 }, pb: 4 }}>
        <Container maxWidth="xl">
          <DemoModeBanner show={demoModeEnabled} />
          <UpgradeProvider>{children}</UpgradeProvider>
        </Container>
      </Box>
    </Box>
  );
}
