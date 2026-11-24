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

describe('workingHourSchema break time', () => {
  const day = { ...base, close_time: '18:00' };

  it('accepts no break, as null or empty strings', () => {
    expect(workingHourSchema.safeParse(day).success).toBe(true);
    expect(workingHourSchema.safeParse({ ...day, break_start: null, break_end: null }).success).toBe(true);
    expect(workingHourSchema.safeParse({ ...day, break_start: '', break_end: '' }).success).toBe(true);
  });

  it('accepts a break inside the opening hours, edges included', () => {
    expect(workingHourSchema.safeParse({ ...day, break_start: '12:00', break_end: '13:00' }).success).toBe(true);
    expect(workingHourSchema.safeParse({ ...day, break_start: '08:00', break_end: '18:00:00' }).success).toBe(true);
  });

  it('accepts a break ending at a midnight close', () => {
    expect(workingHourSchema.safeParse({ ...day, close_time: '00:00', break_start: '22:00', break_end: '23:30' }).success).toBe(true);
  });

  it('refuses half a break and names the missing field', () => {
    const onlyStart = workingHourSchema.safeParse({ ...day, break_start: '12:00', break_end: null });
    expect(onlyStart.success).toBe(false);
    if (!onlyStart.success) expect(onlyStart.error.issues[0]?.path).toEqual(['break_end']);

    const onlyEnd = workingHourSchema.safeParse({ ...day, break_start: '', break_end: '13:00' });
    expect(onlyEnd.success).toBe(false);
    if (!onlyEnd.success) expect(onlyEnd.error.issues[0]?.path).toEqual(['break_start']);
  });

  it('refuses a break that ends at or before its start', () => {
    for (const break_end of ['12:00', '11:00']) {
      const parsed = workingHourSchema.safeParse({ ...day, break_start: '12:00', break_end });
      expect(parsed.success).toBe(false);
      if (!parsed.success) expect(parsed.error.issues[0]?.path).toEqual(['break_end']);
    }
  });

  it('refuses a break outside the opening hours', () => {
    const early = workingHourSchema.safeParse({ ...day, break_start: '07:00', break_end: '09:00' });
    expect(early.success).toBe(false);
    if (!early.success) expect(early.error.issues[0]?.path).toEqual(['break_start']);

    const late = workingHourSchema.safeParse({ ...day, break_start: '17:00', break_end: '19:00' });
    expect(late.success).toBe(false);
    if (!late.success) expect(late.error.issues[0]?.path).toEqual(['break_end']);
  });

  it('refuses a malformed break time', () => {
    expect(workingHourSchema.safeParse({ ...day, break_start: '25:00', break_end: '13:00' }).success).toBe(false);
  });
});
