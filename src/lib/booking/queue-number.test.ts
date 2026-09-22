import { describe, expect, it } from 'vitest';
import { formatQueueNumber } from './queue-number';

describe('formatQueueNumber', () => {
  it('pads the first letter block to three digits', () => {
    expect(formatQueueNumber(1)).toBe('A001');
    expect(formatQueueNumber(42)).toBe('A042');
    expect(formatQueueNumber(999)).toBe('A999');
  });

  it('rolls to the next letter after 999', () => {
    expect(formatQueueNumber(1000)).toBe('B001');
    expect(formatQueueNumber(1998)).toBe('B999');
    expect(formatQueueNumber(1999)).toBe('C001');
    expect(formatQueueNumber(25974)).toBe('Z999');
  });

  it('keeps Z and grows the number past Z999', () => {
    expect(formatQueueNumber(25975)).toBe('Z1000');
    expect(formatQueueNumber(26000)).toBe('Z1025');
  });

  it('never repeats a number within a day', () => {
    const seen = new Set<string>();
    for (let i = 1; i <= 27000; i += 1) seen.add(formatQueueNumber(i));
    expect(seen.size).toBe(27000);
  });

  it('rejects non-positive or fractional ordinals', () => {
    expect(() => formatQueueNumber(0)).toThrow(RangeError);
    expect(() => formatQueueNumber(-1)).toThrow(RangeError);
    expect(() => formatQueueNumber(1.5)).toThrow(RangeError);
  });
});
