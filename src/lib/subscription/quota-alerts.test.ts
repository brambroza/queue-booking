import { describe, expect, it } from 'vitest';
import {
  bangkokDayStartIso,
  crossedQuotaThreshold,
  ownerQuotaLineText,
  quotaExceededText,
  quotaPeriod,
  quotaPeriodLabel,
  quotaThresholdText,
  thresholdCount,
} from './quota-alerts';

describe('thresholdCount', () => {
  it('rounds up', () => {
    expect(thresholdCount(50, 80)).toBe(40);
    expect(thresholdCount(50, 90)).toBe(45);
    expect(thresholdCount(7, 80)).toBe(6);
    expect(thresholdCount(1, 80)).toBe(1);
  });
});

describe('crossedQuotaThreshold', () => {
  it('fires when a booking reaches a threshold', () => {
    expect(crossedQuotaThreshold(39, 40, 50)).toBe(80);
    expect(crossedQuotaThreshold(44, 45, 50)).toBe(90);
    expect(crossedQuotaThreshold(49, 50, 50)).toBe(100);
  });

  it('stays quiet between thresholds or once past them', () => {
    expect(crossedQuotaThreshold(40, 41, 50)).toBeNull();
    expect(crossedQuotaThreshold(10, 11, 50)).toBeNull();
    expect(crossedQuotaThreshold(50, 51, 50)).toBeNull();
  });

  it('reports only the highest threshold for a multi-booking jump', () => {
    expect(crossedQuotaThreshold(38, 46, 50)).toBe(90);
    expect(crossedQuotaThreshold(38, 50, 50)).toBe(100);
  });

  it('never fires for unlimited or bad input', () => {
    expect(crossedQuotaThreshold(39, 40, null)).toBeNull();
    expect(crossedQuotaThreshold(0, 1, 0)).toBeNull();
    expect(crossedQuotaThreshold(40, 40, 50)).toBeNull();
  });
});

describe('period', () => {
  it('uses the booking month', () => {
    expect(quotaPeriod('2026-11-30')).toBe('2026-11');
    expect(quotaPeriodLabel('2026-11')).toBe('พ.ย. 2569');
    expect(quotaPeriodLabel('bad')).toBe('bad');
  });
});

describe('texts', () => {
  it('threshold wording', () => {
    const t80 = quotaThresholdText({ threshold: 80, used: 40, limit: 50, period: '2026-11' });
    expect(t80.title).toContain('80%');
    expect(t80.message).toContain('เหลืออีก 10 คิว');
    expect(quotaThresholdText({ threshold: 100, used: 50, limit: 50, period: '2026-11' }).title).toContain('เต็มแล้ว');
  });

  it('refusal wording by source', () => {
    expect(quotaExceededText('liff').title).toContain('ลูกค้าจองไม่ได้');
    expect(quotaExceededText('staff').title).toContain('พนักงานสร้างคิวไม่ได้');
    expect(quotaExceededText('liff', true).title).toContain('ระงับ');
  });

  it('owner LINE text adds the plan link only for https', () => {
    const text = { title: 'T', message: 'M' };
    expect(ownerQuotaLineText(text, 'ร้าน A', 'https://x.com/')).toBe('[ร้าน A] T\nM\nดูแพ็กเกจ: https://x.com/portal/settings');
    expect(ownerQuotaLineText(text, 'ร้าน A', 'http://localhost:3000')).toBe('[ร้าน A] T\nM');
  });
});

describe('bangkokDayStartIso', () => {
  it('rolls to the Bangkok day', () => {
    expect(bangkokDayStartIso(new Date('2026-11-01T18:30:00Z'))).toBe('2026-11-02T00:00:00+07:00');
    expect(bangkokDayStartIso(new Date('2026-11-01T16:59:00Z'))).toBe('2026-11-01T00:00:00+07:00');
  });
});
