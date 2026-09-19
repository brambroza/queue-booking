import { describe, expect, it } from 'vitest';
import QRCode from 'qrcode';
import sharp from 'sharp';
import { decodeSlipQr } from './decode-image';

const PAYLOAD = '0041000600000101030040220013071152533APM077365102TH9104ABCD';

/** A slip-shaped canvas (tall, white) with a small QR near the bottom, like a bank app renders it. */
async function fakeSlip(format: 'png' | 'jpeg', qrSize = 220): Promise<Uint8Array> {
  const qr = await QRCode.toBuffer(PAYLOAD, { width: qrSize, margin: 2, errorCorrectionLevel: 'M' });
  const canvas = sharp({ create: { width: 1080, height: 1920, channels: 3, background: '#ffffff' } }).composite([
    { input: qr, left: 1080 - qrSize - 60, top: 1920 - qrSize - 120 },
  ]);
  const out = format === 'png' ? await canvas.png().toBuffer() : await canvas.jpeg({ quality: 82 }).toBuffer();
  return new Uint8Array(out);
}

describe('decodeSlipQr', () => {
  it('reads the QR from a PNG screenshot', async () => {
    expect(await decodeSlipQr(await fakeSlip('png'))).toBe(PAYLOAD);
  });

  it('reads the QR after LIFF-style JPEG compression', async () => {
    expect(await decodeSlipQr(await fakeSlip('jpeg'))).toBe(PAYLOAD);
  });

  it('returns null for an image with no QR', async () => {
    const blank = await sharp({ create: { width: 600, height: 900, channels: 3, background: '#ffffff' } }).png().toBuffer();
    expect(await decodeSlipQr(new Uint8Array(blank))).toBeNull();
  });

  it('returns null instead of throwing on bytes that are not an image', async () => {
    expect(await decodeSlipQr(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]))).toBeNull();
  });
});
