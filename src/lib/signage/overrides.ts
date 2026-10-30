import { z } from 'zod';
import { SIGNAGE_LAYOUTS, SIGNAGE_TEMPLATES, SIGNAGE_THEMES, type SignageConfig } from './types';

const OverrideSchema = z.object({
  template: z.enum(SIGNAGE_TEMPLATES).optional(),
  theme: z.enum(SIGNAGE_THEMES).optional(),
  layout: z.enum(SIGNAGE_LAYOUTS).optional(),
});

export type SignageOverrides = Partial<Pick<SignageConfig, 'template' | 'theme' | 'layout'>>;

/**
 * Read the `?template=&theme=&layout=` overrides of the display URL.
 *
 * Only values that are present are returned: the result is spread over the saved
 * config, so a key holding `undefined` would erase the shop's own choice.
 * @param params Query string of the display page.
 * @returns The overrides to apply; empty when any value is invalid.
 */
export function parseSignageOverrides(params: Pick<URLSearchParams, 'get'>): SignageOverrides {
  const parsed = OverrideSchema.safeParse({
    template: params.get('template') ?? undefined,
    theme: params.get('theme') ?? undefined,
    layout: params.get('layout') ?? undefined,
  });
  if (!parsed.success) return {};
  const { template, theme, layout } = parsed.data;
  return { ...(template ? { template } : {}), ...(theme ? { theme } : {}), ...(layout ? { layout } : {}) };
}
