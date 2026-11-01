import { describe, expect, it } from 'vitest';
import { acceptInviteUrl, parseInviteLink } from './invite-link';

describe('parseInviteLink', () => {
  it('reads tokens from an invite link', () => {
    expect(parseInviteLink('#access_token=a&refresh_token=b&type=invite')).toEqual({
      kind: 'session',
      accessToken: 'a',
      refreshToken: 'b',
    });
  });

  it('reads tokens from a recovery link', () => {
    expect(parseInviteLink('access_token=a&refresh_token=b&type=recovery').kind).toBe('session');
  });

  it('reports a used or expired link', () => {
    expect(parseInviteLink('#error=access_denied&error_code=otp_expired')).toEqual({ kind: 'error', code: 'otp_expired' });
  });

  it('ignores other session types and unrelated hashes', () => {
    expect(parseInviteLink('#access_token=a&refresh_token=b&type=signup').kind).toBe('none');
    expect(parseInviteLink('#pricing').kind).toBe('none');
    expect(parseInviteLink('').kind).toBe('none');
  });

  it('needs both tokens', () => {
    expect(parseInviteLink('#access_token=a&type=invite').kind).toBe('none');
  });
});

describe('acceptInviteUrl', () => {
  it('prefers the configured app url', () => {
    expect(acceptInviteUrl('https://app.example.com/', 'https://evil.example')).toBe('https://app.example.com/auth/accept-invite');
  });

  it('falls back to the request origin', () => {
    expect(acceptInviteUrl(undefined, 'http://localhost:3000')).toBe('http://localhost:3000/auth/accept-invite');
  });
});
