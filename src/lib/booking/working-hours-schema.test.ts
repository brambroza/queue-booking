import { describe, expect, it } from 'vitest';
import { workingHourSchema } from './schemas';

const base = {
  branch_id: 'e91cd073-536a-4ce2-a7b0-cb8c591dfef7',
  weekday: 1,
  open_time: '08:00',
  slot_interval_minutes: 60,
};

describe('workingHourSchema close_time', () => {
  it('accepts a close after the open', () => {
    expect(workingHourSchema.safeParse({ ...base, close_time: '18:00' }).success).toBe(true);
  });

  it('accepts 00:00 as closing at midnight', () => {
    expect(workingHourSchema.safeParse({ ...base, close_time: '00:00' }).success).toBe(true);
    expect(workingHourSchema.safeParse({ ...base, close_time: '00:00:00' }).success).toBe(true);
  });

  it('refuses a close at or before the open with a Thai message on close_time', () => {
    for (const close_time of ['08:00', '07:00', '02:00']) {
      const parsed = workingHourSchema.safeParse({ ...base, close_time });
      expect(parsed.success).toBe(false);
      if (!parsed.success) expect(parsed.error.issues[0]?.path).toEqual(['close_time']);
    }
  });
});
