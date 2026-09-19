/**
 * Thai transfer-slip "mini QR" parsing (Bank of Thailand slip verification
 * profile, EMVCo TLV encoding).
 *
 * The QR printed on a bank-app slip carries exactly three useful facts: the
 * sending bank, the transaction reference, and a CRC. It does NOT carry the
 * amount, the receiver, or the time — those only exist on the bank's side. So
 * this module can prove "this is a well-formed slip QR and we have not seen this
 * reference before", never "this money arrived". See evaluate.ts for how that
 * distinction drives the decision.
 *
 * Layout:
 *   00 LL ─┬─ 00 06 "000001"      API id (slip verification)
 *          ├─ 01 03 "004"         sending bank code
 *          └─ 02 LL "<transRef>"  transaction reference
 *   51 02 "TH"                    country
 *   91 04 "<CRC>"                 CRC-16/CCITT-FALSE over everything up to and including "9104"
 */
import { crc16ccitt } from '@/lib/payments/promptpay';

/** API id that marks tag 00 as a slip-verification payload rather than a payment QR. */
const SLIP_API_ID = '000001';
const TAG_PAYLOAD = '00';
const TAG_COUNTRY = '51';
const TAG_CRC = '91';

/** A sane upper bound — real payloads are ~60 chars; anything huge is not a slip. */
const MAX_PAYLOAD_LENGTH = 512;

/** Bank of Thailand 3-digit institution codes seen on consumer slips. */
const BANK_NAME_BY_CODE: Record<string, string> = {
  '002': 'ธนาคารกรุงเทพ',
  '004': 'ธนาคารกสิกรไทย',
  '006': 'ธนาคารกรุงไทย',
  '011': 'ธนาคารทหารไทยธนชาต',
  '014': 'ธนาคารไทยพาณิชย์',
  '017': 'ธนาคารซิตี้แบงก์',
  '020': 'ธนาคารสแตนดาร์ดชาร์เตอร์ด',
  '022': 'ธนาคารซีไอเอ็มบี ไทย',
  '024': 'ธนาคารยูโอบี',
  '025': 'ธนาคารกรุงศรีอยุธยา',
  '030': 'ธนาคารออมสิน',
  '033': 'ธนาคารอาคารสงเคราะห์',
  '034': 'ธ.ก.ส.',
  '066': 'ธนาคารอิสลามแห่งประเทศไทย',
  '067': 'ธนาคารทิสโก้',
  '069': 'ธนาคารเกียรตินาคินภัทร',
  '070': 'ธนาคารไอซีบีซี (ไทย)',
  '071': 'ธนาคารไทยเครดิต',
  '073': 'ธนาคารแลนด์ แอนด์ เฮ้าส์',
};

export type SlipQrFailure = 'empty' | 'too_long' | 'malformed_tlv' | 'not_slip_qr';

export interface ParsedSlipQr {
  sendingBankCode: string;
  /** Thai bank name, or null when the code is not in the registry. */
  sendingBankName: string | null;
  transRef: string;
  countryCode: string | null;
  /** True when the trailing CRC matches the payload. A false value means the QR was altered or misread. */
  crcValid: boolean;
}

export type SlipQrParseResult =
  | { ok: true; slip: ParsedSlipQr }
  | { ok: false; reason: SlipQrFailure };

/**
 * Split an EMVCo TLV string into a tag → value map.
 * Returns null when a length runs past the end or is not numeric.
 */
export function parseTlv(input: string): Map<string, string> | null {
  const fields = new Map<string, string>();
  let cursor = 0;
  while (cursor < input.length) {
    if (cursor + 4 > input.length) return null;
    const tag = input.slice(cursor, cursor + 2);
    const lengthText = input.slice(cursor + 2, cursor + 4);
    if (!/^\d{2}$/.test(lengthText)) return null;
    const length = Number(lengthText);
    const valueStart = cursor + 4;
    if (valueStart + length > input.length) return null;
    fields.set(tag, input.slice(valueStart, valueStart + length));
    cursor = valueStart + length;
  }
  return fields;
}

/** Thai name for a 3-digit bank code, or null when unknown. */
export function slipBankName(code: string | null | undefined): string | null {
  return code ? (BANK_NAME_BY_CODE[code] ?? null) : null;
}

/**
 * Parse the text decoded from a slip's QR code.
 *
 * A payment QR (PromptPay), a URL, or any other QR returns `not_slip_qr` — that
 * is "we cannot tell", not evidence of fraud. A recognised slip QR with a bad
 * CRC still parses, with `crcValid: false`, so the caller can flag it.
 */
export function parseThaiSlipQr(raw: string): SlipQrParseResult {
  const payload = (raw ?? '').trim();
  if (!payload) return { ok: false, reason: 'empty' };
  if (payload.length > MAX_PAYLOAD_LENGTH) return { ok: false, reason: 'too_long' };

  const root = parseTlv(payload);
  if (!root) return { ok: false, reason: 'malformed_tlv' };

  const body = root.get(TAG_PAYLOAD);
  const crc = root.get(TAG_CRC);
  if (!body || !crc) return { ok: false, reason: 'not_slip_qr' };

  const inner = parseTlv(body);
  if (!inner || inner.get('00') !== SLIP_API_ID) return { ok: false, reason: 'not_slip_qr' };

  const sendingBankCode = inner.get('01') ?? '';
  const transRef = inner.get('02') ?? '';
  if (!/^\d{3}$/.test(sendingBankCode) || !/^[A-Za-z0-9]{6,40}$/.test(transRef)) {
    return { ok: false, reason: 'not_slip_qr' };
  }

  // The CRC covers everything before its own value, including the "9104" header.
  const crcValueStart = payload.lastIndexOf(`${TAG_CRC}04`) + 4;
  const crcValid =
    crcValueStart >= 4 &&
    crcValueStart + 4 === payload.length &&
    crc16ccitt(payload.slice(0, crcValueStart)) === crc.toUpperCase();

  return {
    ok: true,
    slip: {
      sendingBankCode,
      sendingBankName: slipBankName(sendingBankCode),
      transRef,
      countryCode: root.get(TAG_COUNTRY) ?? null,
      crcValid,
    },
  };
}
