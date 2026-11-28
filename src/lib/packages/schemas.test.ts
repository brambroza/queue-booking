import { describe, expect, it } from 'vitest';
import { MAX_PACKAGE_DESCRIPTION } from './rules';
import { creditPackagePatchSchema, creditPackageSchema } from './schemas';

const base = { name: 'แพ็กเกจ 5 ชั่วโมง', credit_minutes: 300, price: 2350, valid_days: 45 };

describe('creditPackageSchema description', () => {
  it('accepts a description of exactly the max length', () => {
    const parsed = creditPackageSchema.safeParse({ ...base, description: 'ก'.repeat(MAX_PACKAGE_DESCRIPTION) });
    expect(parsed.success).toBe(true);
  });

  it('accepts a long multi-line description past the old 500 limit', () => {
    const parsed = creditPackageSchema.safeParse({ ...base, description: '• เงื่อนไข\n'.repeat(100) });
    expect(parsed.success).toBe(true);
  });

  it('rejects a description over the max length', () => {
    const parsed = creditPackageSchema.safeParse({ ...base, description: 'ก'.repeat(MAX_PACKAGE_DESCRIPTION + 1) });
    expect(parsed.success).toBe(false);
  });

  it('turns an empty description into null', () => {
    const parsed = creditPackageSchema.parse({ ...base, description: '   ' });
    expect(parsed.description).toBeNull();
  });

  it('applies the same limit on PATCH', () => {
    const id = '00000000-0000-4000-8000-000000000000';
    expect(creditPackagePatchSchema.safeParse({ id, description: 'ก'.repeat(MAX_PACKAGE_DESCRIPTION) }).success).toBe(true);
    expect(creditPackagePatchSchema.safeParse({ id, description: 'ก'.repeat(MAX_PACKAGE_DESCRIPTION + 1) }).success).toBe(false);
  });
});
