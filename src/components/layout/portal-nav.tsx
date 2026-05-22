'use client';

import { usePathname } from 'next/navigation';
import {
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import EventNoteRoundedIcon from '@mui/icons-material/EventNoteRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import ViewKanbanRoundedIcon from '@mui/icons-material/ViewKanbanRounded';
import StoreRoundedIcon from '@mui/icons-material/StoreRounded';
import DesignServicesRoundedIcon from '@mui/icons-material/DesignServicesRounded';
import TableRestaurantRoundedIcon from '@mui/icons-material/TableRestaurantRounded';
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded';
import EventBusyRoundedIcon from '@mui/icons-material/EventBusyRounded';
import GroupRoundedIcon from '@mui/icons-material/GroupRounded';
import PeopleRoundedIcon from '@mui/icons-material/PeopleRounded';
import SettingsEthernetRoundedIcon from '@mui/icons-material/SettingsEthernetRounded';
import ChatRoundedIcon from '@mui/icons-material/ChatRounded';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import TranslateRoundedIcon from '@mui/icons-material/TranslateRounded';
import WorkspacePremiumRoundedIcon from '@mui/icons-material/WorkspacePremiumRounded';
import ScienceRoundedIcon from '@mui/icons-material/ScienceRounded';
import ChecklistRoundedIcon from '@mui/icons-material/ChecklistRounded';
import AppsRoundedIcon from '@mui/icons-material/AppsRounded';
import NotificationsRoundedIcon from '@mui/icons-material/NotificationsRounded';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/components/i18n/i18n-provider';

const groups: Array<{ titleKey: string; items: Array<{ labelKey: string; href: string; icon: React.ReactNode }> }> = [
  {
    titleKey: 'menu.overview',
    items: [
      { labelKey: 'menu.dashboard', href: '/portal/dashboard', icon: <DashboardRoundedIcon fontSize="small" /> },
      { labelKey: 'menu.bookings', href: '/portal/bookings', icon: <EventNoteRoundedIcon fontSize="small" /> },
      { labelKey: 'menu.calendar', href: '/portal/calendar', icon: <CalendarMonthRoundedIcon fontSize="small" /> },
      { labelKey: 'menu.queue_board', href: '/portal/queue-board', icon: <ViewKanbanRoundedIcon fontSize="small" /> },
      { labelKey: 'menu.queue_display', href: '/portal/queue-display', icon: <ViewKanbanRoundedIcon fontSize="small" /> },
    ],
  },
  {
    titleKey: 'menu.management',
    items: [
      { labelKey: 'menu.branches', href: '/portal/branches', icon: <StoreRoundedIcon fontSize="small" /> },
      { labelKey: 'menu.services', href: '/portal/services', icon: <DesignServicesRoundedIcon fontSize="small" /> },
      { labelKey: 'menu.resources', href: '/portal/resources', icon: <TableRestaurantRoundedIcon fontSize="small" /> },
      { labelKey: 'menu.working_hours', href: '/portal/working-hours', icon: <ScheduleRoundedIcon fontSize="small" /> },
      { labelKey: 'menu.holidays', href: '/portal/holidays', icon: <EventBusyRoundedIcon fontSize="small" /> },
      { labelKey: 'menu.staff', href: '/portal/staff', icon: <GroupRoundedIcon fontSize="small" /> },
      { labelKey: 'menu.customers', href: '/portal/customers', icon: <PeopleRoundedIcon fontSize="small" /> },
      { labelKey: 'menu.line_settings', href: '/portal/line-settings', icon: <SettingsEthernetRoundedIcon fontSize="small" /> },
      { labelKey: 'menu.line_onboarding', href: '/portal/onboarding/line-setup', icon: <ChecklistRoundedIcon fontSize="small" /> },
      { labelKey: 'menu.rich_menu_guide', href: '/portal/rich-menu-guide', icon: <AppsRoundedIcon fontSize="small" /> },
      { labelKey: 'menu.chat_inbox', href: '/portal/chat-inbox', icon: <ChatRoundedIcon fontSize="small" /> },
      { labelKey: 'menu.notifications', href: '/portal/notifications', icon: <NotificationsRoundedIcon fontSize="small" /> },
      { labelKey: 'menu.demo_sandbox', href: '/portal/demo-sandbox', icon: <ScienceRoundedIcon fontSize="small" /> },
      { labelKey: 'menu.demo_presentation', href: '/portal/demo-presentation', icon: <ScienceRoundedIcon fontSize="small" /> },
/*       { labelKey: 'menu.demo_line_experience', href: '/portal/demo-line-experience', icon: <ChatRoundedIcon fontSize="small" /> }, */
      { labelKey: 'menu.reports', href: '/portal/reports', icon: <InsightsRoundedIcon fontSize="small" /> },
      { labelKey: 'menu.settings', href: '/portal/settings', icon: <SettingsRoundedIcon fontSize="small" /> },
      { labelKey: 'menu.translations', href: '/portal/translations', icon: <TranslateRoundedIcon fontSize="small" /> },
      { labelKey: 'menu.shop_packages', href: '/portal/shop-subscriptions', icon: <WorkspacePremiumRoundedIcon fontSize="small" /> },
    ],
  },
];

export function PortalNav({ isSuperAdmin = false }: { isSuperAdmin?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useI18n();
  return (
    <Stack spacing={2}>
      {groups.map((g) => (
        <Stack key={g.titleKey} spacing={0.5}>
          <Typography variant="caption" sx={{ px: 1.2, fontWeight: 700, color: 'text.secondary', letterSpacing: 0.5 }}>
            {t(g.titleKey)}
          </Typography>
          <List dense disablePadding>
            {g.items.map(({ labelKey, href, icon }) => {
              if (href === '/portal/translations' && !isSuperAdmin) return null;
              if (href === '/portal/shop-subscriptions' && !isSuperAdmin) return null;
              const active = pathname === href;
              return (
                <ListItemButton
                  key={href}
                  onClick={() => router.push(href)}
                  selected={active}
                  sx={{
                    borderRadius: 2,
                    mb: 0.4,
                    '&.Mui-selected': { bgcolor: 'rgba(115,192,136,0.16)', color: 'primary.main' },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 34, color: 'inherit' }}>{icon}</ListItemIcon>
                  <ListItemText primary={t(labelKey)} primaryTypographyProps={{ fontSize: 14, fontWeight: active ? 700 : 500 }} />
                </ListItemButton>
              );
            })}
          </List>
        </Stack>
      ))}
    </Stack>
  );
}
