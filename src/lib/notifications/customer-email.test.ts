import { afterEach, describe, expect, it, vi } from 'vitest';
import { sanitizeSubject, sendCustomerEmail } from './customer-email';

describe('sanitizeSubject', () => {
  it('collapses line breaks so a shop name cannot inject headers', () => {
    expect(sanitizeSubject('ร้านดี\r\nBcc: x@evil.com')).toBe('ร้านดี Bcc: x@evil.com');
  });

  it('caps the length', () => {
    expect(sanitizeSubject('ก'.repeat(500)).length).toBe(200);
  });
});

describe('sendCustomerEmail', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('reports not_configured instead of pretending to send when no mail transport is set', async () => {
    for (const k of ['SMTP_USER', 'SMTP_PASS', 'SMTP_FROM_EMAIL', 'RESEND_API_KEY', 'RESEND_FROM_EMAIL']) vi.stubEnv(k, '');
    const r = await sendCustomerEmail({ to: 'a@b.co', subject: 's', html: '<p>x</p>', text: 'x' });
    expect(r).toEqual({ ok: false, reason: 'not_configured' });
  });

  it('does not use the Resend sandbox sender (it only reaches the account owner)', async () => {
    for (const k of ['SMTP_USER', 'SMTP_PASS', 'SMTP_FROM_EMAIL', 'RESEND_FROM_EMAIL']) vi.stubEnv(k, '');
    vi.stubEnv('RESEND_API_KEY', 'key');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const r = await sendCustomerEmail({ to: 'a@b.co', subject: 's', html: '<p>x</p>', text: 'x' });
    expect(r.ok).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
