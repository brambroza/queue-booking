import { describe, expect, it } from 'vitest';
import { parseSignageOverrides } from './overrides';
import { DEFAULT_SIGNAGE_CONFIG } from './settings';
import type { SignageConfig } from './types';

const saved: SignageConfig = { ...DEFAULT_SIGNAGE_CONFIG, template: 'lane', theme: 'day_navy', layout: 'portrait' };

describe('parseSignageOverrides', () => {
  it('leaves the saved config alone when the URL has no overrides', () => {
    const overrides = parseSignageOverrides(new URLSearchParams(''));
    expect(overrides).toEqual({});
    expect(Object.keys(overrides)).toHaveLength(0);
    expect({ ...saved, ...overrides }).toEqual(saved);
  });

  it('overrides only the keys in the URL', () => {
    const overrides = parseSignageOverrides(new URLSearchParams('theme=day_court'));
    expect({ ...saved, ...overrides }).toEqual({ ...saved, theme: 'day_court' });
  });

  it('ignores the whole query when a value is invalid', () => {
    expect(parseSignageOverrides(new URLSearchParams('template=nope&theme=day_court'))).toEqual({});
  });
});
