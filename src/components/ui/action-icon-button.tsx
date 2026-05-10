'use client';

import { ReactNode } from 'react';
import { CircularProgress, IconButton, Tooltip } from '@mui/material';
import type { IconButtonProps, TooltipProps } from '@mui/material';
import { useTranslation } from '@/lib/i18n/useTranslation';

type Props = {
  icon: ReactNode;
  labelKey?: string;
  fallbackLabel: string;
  color?: IconButtonProps['color'];
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  size?: IconButtonProps['size'];
  confirmBeforeClick?: boolean;
  confirmTitle?: string;
  confirmMessage?: string;
  tooltipPlacement?: TooltipProps['placement'];
};

export function ActionIconButton({
  icon,
  labelKey,
  fallbackLabel,
  color = 'default',
  disabled,
  loading,
  onClick,
  size = 'small',
  confirmBeforeClick = false,
  confirmTitle,
  confirmMessage,
  tooltipPlacement = 'top',
}: Props) {
  const { t } = useTranslation();
  const label = labelKey ? t(labelKey, fallbackLabel) : fallbackLabel;

  function handleClick() {
    if (!onClick || disabled || loading) return;
    if (confirmBeforeClick) {
      const message = confirmMessage ?? label;
      const withTitle = confirmTitle ? `${confirmTitle}\n\n${message}` : message;
      if (!window.confirm(withTitle)) return;
    }
    onClick();
  }

  return (
    <Tooltip title={label} placement={tooltipPlacement}>
      <span>
        <IconButton aria-label={label} color={color} disabled={disabled || loading} onClick={handleClick} size={size}>
          {loading ? <CircularProgress size={18} /> : icon}
        </IconButton>
      </span>
    </Tooltip>
  );
}
