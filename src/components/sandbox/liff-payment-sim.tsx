'use client';

import { useEffect, useState, type Dispatch } from 'react';
import type { PayMethodChoice } from '@/lib/demo/sandbox-sim/tour';
import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import { BankGrid } from '@/components/line/bank-grid';
import { KeyValueList, LiffLabel, LiffSection, OptionCard } from '@/components/line/liff-ui';
import { DEMO_PAYEE, formatTHB } from '@/lib/demo/payment-demo';
import { MOBILE_BANKS } from '@/lib/payments/mobile-banking/banks';
import { formatBaht } from '@/lib/demo/sandbox-sim/amount';
import type { SimAction, SimQueue } from '@/lib/demo/sandbox-sim/types';

type Method = PayMethodChoice;

/** A QR drawn from a harmless text payload: scannable, but no banking app can act on it. */
function SandboxQr({ seed }: { seed: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void import('qrcode').then(async (QRCode) => {
      const url = await QRCode.toDataURL(`SANDBOX-DEMO-ONLY|${seed}`, {
        width: 360,
        margin: 1,
        errorCorrectionLevel: 'M',
      });
      if (!cancelled) setSrc(url);
    });
    return () => {
      cancelled = true;
    };
  }, [seed]);
  return (
    <Stack alignItems="center" spacing={0.5}>
      <Box
        sx={{
          width: 180,
          height: 180,
          borderRadius: '12px',
          border: 1,
          borderColor: 'divider',
          bgcolor: '#fff',
          display: 'grid',
          placeItems: 'center',
          overflow: 'hidden',
        }}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element -- data URL
          <img src={src} alt="QR PromptPay ตัวอย่าง (ใช้จ่ายจริงไม่ได้)" width={180} height={180} style={{ display: 'block' }} />
        ) : null}
      </Box>
      <Typography variant="caption" color="text.secondary">
        QR ตัวอย่าง ใช้โอนเงินจริงไม่ได้
      </Typography>
    </Stack>
  );
}

/**
 * Payment panel of the sandbox LIFF, shaped like `LiffPaymentPanel`: amount on
 * top, then the three methods the real flow offers (PromptPay QR, bank app,
 * bank transfer + slip). Nothing is sent anywhere; each action just moves the
 * sandbox state, which also pushes the same Flex receipts into the chat.
 *
 * @param queue - The visitor's queue (must have a `payment`).
 * @param dispatch - Sandbox reducer dispatch.
 * @param onMethod - Called when the visitor picks a payment method.
 */
export function LiffPaymentSim({
  queue,
  dispatch,
  onMethod,
}: {
  queue: SimQueue;
  dispatch: Dispatch<SimAction>;
  /** Reports the chosen method to the tour. */
  onMethod?: (method: Method | null) => void;
}) {
  const [method, setMethod] = useState<Method | null>(null);
  useEffect(() => {
    onMethod?.(method);
  }, [method, onMethod]);
  const [bankCode, setBankCode] = useState<string | null>(null);
  const [slipPicked, setSlipPicked] = useState(false);
  const payment = queue.payment;
  if (!payment) return null;
  const amount = payment.amount;

  if (payment.status === 'paid') {
    return (
      <Alert severity="success" icon={<CheckRoundedIcon fontSize="inherit" />}>
        <Typography variant="body2" sx={{ fontWeight: 700 }}>
          ชำระเงินเรียบร้อยแล้ว
        </Typography>
        <Typography variant="caption">{formatTHB(amount)} บาท</Typography>
      </Alert>
    );
  }

  if (payment.status === 'awaiting_verification') {
    return (
      <LiffSection title="ชำระเงิน">
        <Alert severity="info">
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            ได้รับสลิปแล้ว กำลังตรวจสอบ
          </Typography>
          <Typography variant="caption">ในระบบจริง ระบบตรวจสลิปกับธนาคารอัตโนมัติ หรือร้านกดอนุมัติเอง</Typography>
        </Alert>
        <Button data-tour="pay-verify" variant="contained" size="large" fullWidth onClick={() => dispatch({ type: 'verify_slip', queueId: queue.id })}>
          ตรวจสลิป
        </Button>
      </LiffSection>
    );
  }

  const bank = bankCode ? MOBILE_BANKS.find((b) => b.code === bankCode) : undefined;

  return (
    <LiffSection title="ชำระเงิน">
      <Stack data-tour="pay-amount" alignItems="center" sx={{ textAlign: 'center', pt: 0.5 }}>
        <Typography variant="caption" color="text.secondary">
          ยอดที่ต้องชำระ
        </Typography>
        <Typography
          variant="h4"
          sx={{
            fontWeight: 800,
            color: 'primary.main',
            letterSpacing: '-0.02em',
            lineHeight: 1.1,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {formatTHB(amount)} บาท
        </Typography>
      </Stack>

      <LiffLabel>เลือกวิธีชำระเงิน</LiffLabel>
      <Stack spacing={1} data-tour={method ? undefined : 'pay-methods'}>
        <OptionCard icon="📱" title="สแกน QR PromptPay" subtitle="ยืนยันให้อัตโนมัติทันทีที่โอนสำเร็จ" selected={method === 'promptpay'} onClick={() => setMethod('promptpay')} />
        <OptionCard
          icon="🏦"
          title="จ่ายผ่านแอปธนาคาร"
          subtitle="เด้งเข้าแอป ยอดล็อกไว้ ใส่ PIN แล้วยืนยัน"
          selected={method === 'bank_app'}
          onClick={() => setMethod('bank_app')}
        />
        <OptionCard icon="🧾" title="โอนเงิน + ส่งสลิป" subtitle="แนบสลิป ระบบตรวจให้" selected={method === 'transfer'} onClick={() => setMethod('transfer')} />
      </Stack>

      {method === 'promptpay' ? (
        <Stack spacing={1.25}>
          <Box data-tour="pay-qr">
            <SandboxQr seed={`${queue.queueNo}|${amount}`} />
          </Box>
          <Button
            data-tour="pay-action"
            variant="contained"
            size="large"
            fullWidth
            onClick={() =>
              dispatch({
                type: 'pay',
                queueId: queue.id,
                method: 'omise_promptpay',
              })
            }
          >
            จำลอง: สแกนจ่ายแล้ว
          </Button>
        </Stack>
      ) : null}

      {method === 'bank_app' ? (
        <Stack spacing={1.25}>
          <Box data-tour="pay-banks">
            <Box data-tour={bank ? undefined : 'pay-action'}>
              <BankGrid
                banks={MOBILE_BANKS.map((b) => ({
                  code: b.code,
                  name: b.name,
                }))}
                value={bankCode}
                onChange={setBankCode}
                size="small"
              />
            </Box>
          </Box>
          {bank ? (
            <Box
              sx={{
                borderRadius: '16px',
                p: 2,
                bgcolor: bank.color,
                color: bank.code === 'bay' ? '#111827' : '#fff',
              }}
            >
              <Typography variant="caption" sx={{ opacity: 0.85 }}>
                กำลังเปิดแอป {bank.name} (จำลอง)
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                ยอดล็อกไว้ {formatBaht(amount)}
              </Typography>
              <Button
                data-tour="pay-action"
                variant="contained"
                fullWidth
                sx={{
                  mt: 1.25,
                  bgcolor: '#fff',
                  color: '#111827',
                  '&:hover': { bgcolor: '#f3f4f6' },
                }}
                onClick={() =>
                  dispatch({
                    type: 'pay',
                    queueId: queue.id,
                    method: 'omise_mobile_banking',
                    bank: bank.code,
                  })
                }
              >
                ใส่ PIN แล้วยืนยันการชำระ
              </Button>
            </Box>
          ) : (
            <Typography variant="caption" color="text.secondary">
              เลือกแอปธนาคารที่ใช้
            </Typography>
          )}
        </Stack>
      ) : null}

      {method === 'transfer' ? (
        <Stack spacing={1.25}>
          <SandboxQr seed={`${queue.queueNo}|transfer|${amount}`} />
          <Box data-tour="pay-account">
            <KeyValueList
              dense
              rows={[
                { label: 'ธนาคาร', value: DEMO_PAYEE.bankName },
                { label: 'เลขบัญชี', value: DEMO_PAYEE.bankAccountNo },
                { label: 'ชื่อบัญชี', value: DEMO_PAYEE.bankAccountName },
              ]}
            />
          </Box>
          {slipPicked ? (
            <Box
              sx={{
                border: 1,
                borderColor: 'divider',
                borderRadius: '12px',
                p: 1.5,
                bgcolor: 'grey.50',
              }}
            >
              <Typography variant="caption" color="text.secondary">
                สลิปตัวอย่าง (ไม่อัปโหลดจริง)
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                โอนสำเร็จ {formatTHB(amount)} บาท
              </Typography>
              <Typography variant="caption" color="text.secondary">
                ไปยัง {DEMO_PAYEE.bankAccountName}
              </Typography>
            </Box>
          ) : (
            <Button data-tour="pay-slip" variant="outlined" fullWidth onClick={() => setSlipPicked(true)}>
              แนบสลิป
            </Button>
          )}
          <Button
            data-tour={slipPicked ? 'pay-send' : undefined}
            variant="contained"
            size="large"
            fullWidth
            disabled={!slipPicked}
            onClick={() => dispatch({ type: 'submit_slip', queueId: queue.id })}
          >
            ส่งสลิป
          </Button>
        </Stack>
      ) : null}
    </LiffSection>
  );
}
