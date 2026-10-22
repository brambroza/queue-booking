import { describe, expect, it } from 'vitest';
import {
  bangkokLocalToIso,
  bangkokTimeOf,
  isReleased,
  isoToBangkokLocal,
  notReleasedMessage,
  releaseCountdown,
  releaseJitterMs,
  RELEASE_JITTER_MS,
} from './booking-release';

const RELEASE = '2026-10-25T19:00:00+07:00';
const at = (iso: string) => Date.parse(iso);

describe('isReleased', () => {
  it('is open when unset or invalid', () => {
    expect(isReleased(null, 0)).toBe(true);
    expect(isReleased('nope', 0)).toBe(true);
  });

  it('opens exactly at the release moment', () => {
    expect(isReleased(RELEASE, at('2026-10-25T18:59:59+07:00'))).toBe(false);
    expect(isReleased(RELEASE, at('2026-10-25T19:00:00+07:00'))).toBe(true);
  });
});

describe('releaseCountdown', () => {
  it('splits the remaining time', () => {
    expect(releaseCountdown(RELEASE, at('2026-10-24T17:58:30+07:00'))).toMatchObject({ days: 1, hours: 1, minutes: 1, seconds: 30 });
  });

  it('is zero after release', () => {
    expect(releaseCountdown(RELEASE, at('2026-10-26T00:00:00+07:00'))).toMatchObject({ remainingMs: 0, seconds: 0 });
  });
});

describe('releaseJitterMs', () => {
  it('stays within the spread', () => {
    expect(releaseJitterMs(() => 0)).toBe(0);
    expect(releaseJitterMs(() => 0.999)).toBeLessThan(RELEASE_JITTER_MS);
  });
});

describe('Bangkok wall clock conversion', () => {
  it('reads a datetime-local value as Bangkok time', () => {
    expect(bangkokLocalToIso('2026-10-25T19:00')).toBe('2026-10-25T19:00:00+07:00');
    expect(bangkokLocalToIso('')).toBeNull();
    expect(bangkokLocalToIso('25/10/2026')).toBeUndefined();
  });

  it('round-trips a stored UTC timestamp back to the form value', () => {
    expect(isoToBangkokLocal('2026-10-25T12:00:00+00:00')).toBe('2026-10-25T19:00');
    expect(bangkokTimeOf('2026-10-25T12:00:00Z')).toBe('19:00');
    expect(bangkokLocalToIso('2026-10-25T12:00:00Z')).toBe('2026-10-25T12:00:00.000Z');
  });

  it('names the Bangkok time in the refusal message', () => {
    expect(notReleasedMessage('2026-10-25T12:00:00Z')).toContain('19:00');
  });
});
