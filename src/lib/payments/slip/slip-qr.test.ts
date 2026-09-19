import { describe, expect, it } from 'vitest';
import { crc16ccitt } from '@/lib/payments/promptpay';
import { parseThaiSlipQr, parseTlv, slipBankName } from './slip-qr';

const tlv = (id: string, value: string) => `${id}${String(value.length).padStart(2, '0')}${value}`;

/** Build a slip QR payload the way a bank app does. */
function buildSlipQr(opts: { bank?: string; transRef?: string; apiId?: string; country?: string | null } = {}) {
  const body = tlv('00', opts.apiId ?? '000001') + tlv('01', opts.bank ?? '004') + tlv('02', opts.transRef ?? '013071152533APM07736');
  let payload = tlv('00', body);
  if (opts.country !== null) payload += tlv('51', opts.country ?? 'TH');
  payload += '9104';
  return payload + crc16ccitt(payload);
}

describe('parseTlv', () => {
  it('splits consecutive fields', () => {
    expect(Object.fromEntries(parseTlv('0002AB5102TH') ?? [])).toEqual({ '00': 'AB', '51': 'TH' });
  });

  it('rejects a length that runs past the end', () => {
    expect(parseTlv('0009AB')).toBeNull();
  });

  it('rejects a non-numeric length', () => {
    expect(parseTlv('00XXAB')).toBeNull();
  });
});

describe('parseThaiSlipQr', () => {
  it('reads bank, reference and country from a well-formed slip QR', () => {
    const result = parseThaiSlipQr(buildSlipQr());
    expect(result).toEqual({
      ok: true,
      slip: {
        sendingBankCode: '004',
        sendingBankName: 'ธนาคารกสิกรไทย',
        transRef: '013071152533APM07736',
        countryCode: 'TH',
        crcValid: true,
      },
    });
  });

  it('has the documented 41-char body for a 20-char reference', () => {
    expect(buildSlipQr().startsWith('0041')).toBe(true);
  });

  it('flags a tampered reference through the CRC', () => {
    const tampered = buildSlipQr().replace('APM07736', 'APM07737');
    const result = parseThaiSlipQr(tampered);
    expect(result.ok && result.slip.crcValid).toBe(false);
    expect(result.ok && result.slip.transRef).toBe('013071152533APM07737');
  });

  it('accepts a lowercase CRC', () => {
    const payload = buildSlipQr();
    const lower = payload.slice(0, -4) + payload.slice(-4).toLowerCase();
    const result = parseThaiSlipQr(lower);
    expect(result.ok && result.slip.crcValid).toBe(true);
  });

  it('tolerates surrounding whitespace', () => {
    const result = parseThaiSlipQr(`  ${buildSlipQr()}\n`);
    expect(result.ok && result.slip.crcValid).toBe(true);
  });

  it('keeps an unknown bank code but reports no name', () => {
    const result = parseThaiSlipQr(buildSlipQr({ bank: '999' }));
    expect(result.ok && result.slip.sendingBankName).toBeNull();
  });

  it('reports a missing country tag as null', () => {
    const result = parseThaiSlipQr(buildSlipQr({ country: null }));
    expect(result.ok && result.slip.countryCode).toBeNull();
  });

  it.each([
    ['empty string', '', 'empty'],
    ['a URL', 'https://example.com/pay?id=1', 'malformed_tlv'],
    ['a PromptPay payment QR', '00020101021129370016A000000677010111011300668123456785802TH530376463041234', 'not_slip_qr'],
    ['another API id', buildSlipQr({ apiId: '000002' }), 'not_slip_qr'],
    ['a non-numeric bank code', buildSlipQr({ bank: 'ABC' }), 'not_slip_qr'],
    ['a reference with symbols', buildSlipQr({ transRef: "1' OR '1'='1" }), 'not_slip_qr'],
    ['an oversized payload', '0'.repeat(600), 'too_long'],
  ])('rejects %s', (_label, payload, reason) => {
    expect(parseThaiSlipQr(payload)).toEqual({ ok: false, reason });
  });
});

describe('slipBankName', () => {
  it('maps known codes and returns null otherwise', () => {
    expect(slipBankName('014')).toBe('ธนาคารไทยพาณิชย์');
    expect(slipBankName('000')).toBeNull();
    expect(slipBankName(null)).toBeNull();
  });
});
