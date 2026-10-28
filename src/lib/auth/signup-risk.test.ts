import { describe, expect, it } from 'vitest';
import { looksRandomLatin, normalizeEmailForDedup, scoreSignup, SIGNUP_RISK_BLOCK } from './signup-risk';

describe('normalizeEmailForDedup', () => {
  it('folds gmail dots and +tags', () => {
    expect(normalizeEmailForDedup('A.b.C+promo@GMail.com')).toBe('abc@gmail.com');
    expect(normalizeEmailForDedup('abc@googlemail.com')).toBe('abc@gmail.com');
  });

  it('keeps dots for other domains but drops +tags', () => {
    expect(normalizeEmailForDedup('first.last+x@shop.co.th')).toBe('first.last@shop.co.th');
  });
});

describe('looksRandomLatin', () => {
  it('matches bot-style mixed-case strings', () => {
    expect(looksRandomLatin('xKjdhGqwePlm')).toBe(true);
  });

  it('ignores Thai, normal names and short words', () => {
    expect(looksRandomLatin('สมชาย ใจดี')).toBe(false);
    expect(looksRandomLatin('Somchai Jaidee')).toBe(false);
    expect(looksRandomLatin('McDonaldMcKay')).toBe(true); // known edge: still only 2 points
    expect(looksRandomLatin('GoAlong')).toBe(false);
  });
});

describe('scoreSignup', () => {
  const real = {
    email: 'somchai@gmail.com',
    owner_name: 'สมชาย ใจดี',
    shop_name: 'ร้านตัดผมสมชาย',
    company_name: 'บริษัท สมชาย จำกัด',
  };

  it('scores a real Thai signup zero', () => {
    expect(scoreSignup(real)).toEqual({ score: 0, reasons: [] });
  });

  it('blocks random names on more than one field', () => {
    const risk = scoreSignup({ ...real, owner_name: 'xKjdhGqwePlm', shop_name: 'pQwLmnZxcVbn' });
    expect(risk.score).toBeGreaterThanOrEqual(SIGNUP_RISK_BLOCK);
    expect(risk.reasons).toEqual(expect.arrayContaining(['random_owner', 'random_shop']));
  });

  it('only tags a single weak signal', () => {
    const risk = scoreSignup({ ...real, email: 'a.b.c.d@gmail.com' });
    expect(risk).toEqual({ score: 2, reasons: ['gmail_dots'] });
    expect(risk.score).toBeLessThan(SIGNUP_RISK_BLOCK);
  });

  it('blocks disposable inboxes', () => {
    expect(scoreSignup({ ...real, email: 'x@mailinator.com' }).score).toBeGreaterThanOrEqual(SIGNUP_RISK_BLOCK);
  });

  it('notices identical names across fields', () => {
    expect(scoreSignup({ ...real, owner_name: 'test', shop_name: 'test', company_name: 'TEST' }).reasons).toContain('same_names');
  });
});
