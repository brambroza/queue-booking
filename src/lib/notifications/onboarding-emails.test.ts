import { describe, expect, it } from 'vitest';
import { SUPPORT_CONTACT, buildGoLiveEmail, buildSetupGuideEmail } from './onboarding-emails';

describe('buildSetupGuideEmail', () => {
  const mail = buildSetupGuideEmail({ ownerName: 'สมชาย ใจดี' });

  it('uses the agreed subject and greets the owner', () => {
    expect(mail.subject).toBe('QueueBooking ระบบจองคิวผ่าน LINE OA');
    expect(mail.text).toContain('เรียนคุณ สมชาย ใจดี,');
    expect(mail.html).toContain('เรียนคุณ สมชาย ใจดี,');
  });

  it('mentions the attachment and carries the support details in both parts', () => {
    for (const body of [mail.html, mail.text]) {
      expect(body).toContain('ไฟล์แนบ');
      expect(body).toContain(SUPPORT_CONTACT.emailPrimary);
      expect(body).toContain(SUPPORT_CONTACT.phone);
      expect(body).toContain(SUPPORT_CONTACT.line);
    }
  });

  it('escapes a hostile owner name in the HTML but not in the plain text', () => {
    const evil = buildSetupGuideEmail({ ownerName: '<script>alert(1)</script>' });
    expect(evil.html).not.toContain('<script>');
    expect(evil.html).toContain('&lt;script&gt;');
    expect(evil.text).toContain('<script>');
  });
});

describe('buildGoLiveEmail', () => {
  const mail = buildGoLiveEmail({ ownerName: 'สมหญิง', shopName: 'ร้านตัดผมดี' });

  it('puts the shop name in the subject', () => {
    expect(mail.subject).toBe('ระบบจองคิว QueueBooking ของ ร้านตัดผมดี พร้อมใช้งานแล้ว');
  });

  it('says demo mode was closed and lists both addresses', () => {
    for (const body of [mail.html, mail.text]) {
      expect(body).toContain('ปิดโหมดทดลอง');
      expect(body).toContain(SUPPORT_CONTACT.emailPrimary);
      expect(body).toContain(SUPPORT_CONTACT.emailSecondary);
      expect(body).toContain('อำนาจ กองเพชร');
    }
  });

  it('escapes the shop name in the HTML body', () => {
    const evil = buildGoLiveEmail({ ownerName: 'x', shopName: '<img src=x onerror=1>' });
    expect(evil.html).not.toContain('<img src=x');
    expect(evil.html).toContain('&lt;img');
  });
});

describe('support contact', () => {
  it('uses one phone number everywhere', () => {
    const all = [buildSetupGuideEmail({ ownerName: 'a' }).text, buildGoLiveEmail({ ownerName: 'a', shopName: 'b' }).text].join('\n');
    expect(all).toContain('085-608-3298');
    expect(all).not.toContain('086-608-3298');
  });
});
