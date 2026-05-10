'use client';

import { ReactNode, useMemo, useState } from 'react';
import { IconButton, Menu, MenuItem, Tooltip } from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { ActionIconButton } from '@/components/ui/action-icon-button';
import { useTranslation } from '@/lib/i18n/useTranslation';

type ActionItem = {
  key: string;
  icon: ReactNode;
  labelKey?: string;
  fallbackLabel: string;
  color?: 'default' | 'inherit' | 'primary' | 'secondary' | 'success' | 'error' | 'info' | 'warning';
  hidden?: boolean;
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  confirmBeforeClick?: boolean;
  confirmTitle?: string;
  confirmMessage?: string;
};

export function ActionIconGroup({ actions }: { actions: ActionItem[] }) {
  const { t } = useTranslation();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const visible = useMemo(() => actions.filter((a) => !a.hidden), [actions]);
  const primary = visible.slice(0, 3);
  const secondary = visible.slice(3);

  return (
    <div className="inline-flex items-center gap-0.5">
      {primary.map((a) => (
        <ActionIconButton
          key={a.key}
          icon={a.icon}
          labelKey={a.labelKey}
          fallbackLabel={a.fallbackLabel}
          color={a.color}
          disabled={a.disabled}
          loading={a.loading}
          onClick={a.onClick}
          confirmBeforeClick={a.confirmBeforeClick}
          confirmTitle={a.confirmTitle}
          confirmMessage={a.confirmMessage}
          size="small"
        />
      ))}

      {secondary.length > 0 ? (
        <>
          <Tooltip title={t('common.more_actions', 'More actions')}>
            <span>
              <IconButton
                size="small"
                aria-label={t('common.more_actions', 'More actions')}
                onClick={(e) => setAnchorEl(e.currentTarget)}
              >
                <MoreVertIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
            {secondary.map((a) => (
              <MenuItem
                key={a.key}
                disabled={a.disabled || a.loading}
                onClick={() => {
                  setAnchorEl(null);
                  if (a.confirmBeforeClick) {
                    const title = a.confirmTitle ?? a.fallbackLabel;
                    const message = a.confirmMessage ?? '';
                    if (!window.confirm(`${title}${message ? `\n\n${message}` : ''}`)) return;
                  }
                  a.onClick?.();
                }}
              >
                {a.fallbackLabel}
              </MenuItem>
            ))}
          </Menu>
        </>
      ) : null}
    </div>
  );
}
