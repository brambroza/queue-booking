// Writes docs/guides/images/payment/flex-samples.js: the LINE Flex messages the
// app really sends in the payment flow, built by the app's own builders with
// sample data, for the "ลูกค้าเห็นใน LINE" panels of the infographic.
// Run from the repo root: node docs/guides/payment-infographic-flex.mjs
import createJiti from 'jiti';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import QRCode from 'qrcode';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
// jiti 1.x (already in node_modules): a require() that compiles TypeScript and resolves `@/`.
const jiti = createJiti(fileURLToPath(import.meta.url), { alias: { '@': path.join(root, 'src') } });
const messages = jiti(path.join(root, 'src/lib/line/messages.ts'));
const payment = jiti(path.join(root, 'src/lib/line/messages-payment.ts'));

const today = new Date();
const dateLabel = today.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Bangkok' });
const qr = await QRCode.toDataURL('ตัวอย่าง QR ในคู่มือ ใช้ชำระเงินไม่ได้', { margin: 1, width: 360 });
const common = { shopName: 'สมาร์ทแบดมินตัน', queueNumber: 'A012', service: 'เช่าสนาม 1 ชั่วโมง', branch: 'สาขารามอินทรา', date: dateLabel, time: '15:00' };
const liff = 'https://liff.line.me/sample';

const samples = {
  confirm: messages.bookingConfirmFlex({ ...common, assignedTo: 'สนาม 2', assignedLabel: 'สนาม', liffUrl: liff, awaitingPayment: true, bookingId: 'sample' }),
  transfer: payment.transferPaymentFlex({
    ...common, amountTHB: 180, qrImageUrl: qr, payeeName: 'สมาร์ทแบดมินตัน', promptpayMasked: '080-xxx-0000',
    bankName: 'ธนาคารกสิกรไทย', bankAccountNo: '000-0-00000-0', expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(), uploadUrl: liff,
  }),
  slipReceived: payment.slipReceivedFlex({ shopName: common.shopName, queueNumber: 'A012', amountTHB: 180 }),
  receipt: payment.paymentReceiptFlex({ ...common, amountTHB: 180, receiptRef: 'RCP-A012-SAMPLE', paidAt: new Date().toISOString() }),
  expired: messages.bookingPaymentExpiredFlex({ shopName: common.shopName, queueNumber: 'A012', date: dateLabel, time: '15:00', liffUrl: liff }),
};

const out = path.join(root, 'docs/guides/images/payment/flex-samples.js');
writeFileSync(out, `window.FLEX_SAMPLES = ${JSON.stringify(samples)};\n`);
console.log('wrote', path.relative(root, out), Object.keys(samples).join(', '));
