import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkFormToken, FORM_TOKEN_MAX_AGE_MS, issueFormToken } from './form-token';

const T0 = 1_800_000_000_000;

describe('form token', () => {
  beforeEach(() => {
    vi.stubEnv('FORM_TOKEN_SECRET', 'test-secret');
    vi.stubEnv('PAYMENT_LINK_SECRET', '');
  });
  afterEach(() => vi.unstubAllEnvs());

  it('accepts a token submitted after the minimum fill time', () => {
    expect(checkFormToken(issueFormToken(T0), T0 + 10_000)).toBe('ok');
  });

  it('flags a submit faster than a person can type', () => {
    expect(checkFormToken(issueFormToken(T0), T0 + 1_000)).toBe('too_fast');
  });

  it('flags a token older than the max age', () => {
    expect(checkFormToken(issueFormToken(T0), T0 + FORM_TOKEN_MAX_AGE_MS + 1)).toBe('expired');
  });

  it('rejects a forged issue time', () => {
    const [, mac] = issueFormToken(T0).split('.');
    expect(checkFormToken(`${T0 - 60_000}.${mac}`, T0 + 10_000)).toBe('bad');
  });

  it('rejects missing and malformed tokens', () => {
    expect(checkFormToken(undefined, T0)).toBe('bad');
    expect(checkFormToken('', T0)).toBe('bad');
    expect(checkFormToken('abc.def', T0)).toBe('bad');
    expect(checkFormToken(`${issueFormToken(T0)}.x`, T0 + 10_000)).toBe('bad');
  });

  it('falls back to PAYMENT_LINK_SECRET', () => {
    vi.stubEnv('FORM_TOKEN_SECRET', '');
    vi.stubEnv('PAYMENT_LINK_SECRET', 'other');
    expect(checkFormToken(issueFormToken(T0), T0 + 10_000)).toBe('ok');
  });

  it('without a secret: ok in development, no_secret in production', () => {
    vi.stubEnv('FORM_TOKEN_SECRET', '');
    vi.stubEnv('NODE_ENV', 'development');
    expect(issueFormToken(T0)).toBe('');
    expect(checkFormToken('', T0)).toBe('ok');
    vi.stubEnv('NODE_ENV', 'production');
    expect(checkFormToken('', T0)).toBe('no_secret');
  });
});
