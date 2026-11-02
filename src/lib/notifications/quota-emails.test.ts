import { describe, expect, it } from 'vitest';
import { buildAdminQuotaEmail, buildOwnerQuotaEmail, nextPlanCode, planLabel } from './quota-emails';

const base = {
  ownerName: 'สมชาย',
  shopName: 'ร้าน <b>A</b>',
  shopKey: 'SHOP-ABC',
  threshold: 80 as const,
  used: 40,
  limit: 50,
  period: '2026-11',
  planCode: 'starter',
  appUrl: 'https://queuebooking.com/',
};

describe('plans', () => {
  it('walks the ladder', () => {
    expect(nextPlanCode('starter')).toBe('professional');
    expect(nextPlanCode(null)).toBe('professional');
    expect(nextPlanCode('business')).toBe('enterprise');
    expect(nextPlanCode('enterprise')).toBeNull();
    expect(nextPlanCode('custom')).toBeNull();
    expect(planLabel('professional')).toBe('Professional');
    expect(planLabel('custom')).toBe('custom');
  });
});

describe('buildOwnerQuotaEmail', () => {
  it('80 %: usage, remaining, suggestion and https link', () => {
    const e = buildOwnerQuotaEmail(base);
    expect(e.subject).toBe('[QueueBooking] ร้าน <b>A</b> ใช้โควต้าการจองเดือน พ.ย. 2569 ไปแล้ว 80%');
    expect(e.html).toContain('40 / 50');
    expect(e.html).toContain('<b>10 คิว</b>');
    expect(e.html).toContain('Professional');
    expect(e.html).toContain('https://queuebooking.com/portal/settings');
    expect(e.text).toContain('คงเหลือ: 10 คิว');
  });

  it('escapes shop and owner names in HTML', () => {
    const e = buildOwnerQuotaEmail({ ...base, ownerName: '<script>x</script>' });
    expect(e.html).not.toContain('<b>A</b>');
    expect(e.html).toContain('ร้าน &lt;b&gt;A&lt;/b&gt;');
    expect(e.html).not.toContain('<script>');
  });

  it('100 %: full wording', () => {
    const e = buildOwnerQuotaEmail({ ...base, threshold: 100, used: 50 });
    expect(e.subject).toContain('ครบแล้ว');
    expect(e.html).toContain('ไม่สามารถจองคิวที่มีวันนัดในเดือนนี้เพิ่มได้');
    expect(e.html).toContain('ปรับแพ็กเกจเพื่อเปิดรับคิวต่อ');
  });

  it('drops links without an https base', () => {
    const e = buildOwnerQuotaEmail({ ...base, appUrl: 'http://localhost:3000' });
    expect(e.html).not.toContain('localhost');
    expect(e.text).not.toContain('ดูแพ็กเกจ:');
  });
});

describe('buildAdminQuotaEmail', () => {
  it('summarises the shop and what reached the owner', () => {
    const e = buildAdminQuotaEmail({
      ...base,
      threshold: 90,
      used: 45,
      ownerEmail: 'a@b.co',
      ownerPhone: '0812345678',
      ownerEmailStatus: 'sent',
      ownerLineStatus: 'not_linked',
    });
    expect(e.subject).toBe('[Quota 90%] ร้าน <b>A</b> · 45/50 คิว (พ.ย. 2569)');
    expect(e.html).toContain('SHOP-ABC');
    expect(e.html).toContain('a@b.co · ส่งแล้ว');
    expect(e.html).toContain('ยังไม่ได้เชื่อม');
    expect(e.html).toContain('Starter → แนะนำ Professional');
    expect(e.html).toContain('/portal/shop-subscriptions');
    expect(e.html).not.toContain('<b>A</b>');
  });
});
