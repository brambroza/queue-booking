'use client';

import { useI18n } from '@/lib/i18n/provider';

export function useTranslation(namespace?: string) {
  const { t, tNamespace, ...rest } = useI18n();
  const translate = (key: string, fallback?: string) =>
    namespace ? tNamespace(namespace, key, fallback) : t(key, fallback);
  return { t: translate, ...rest };
}
