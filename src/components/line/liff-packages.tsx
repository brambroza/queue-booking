'use client';

import { ChangeEvent, useCallback, useEffect, useState } from 'react';
import { Alert, Box, Button, Chip, LinearProgress, Stack, Typography } from '@mui/material';
import CardMembershipRoundedIcon from '@mui/icons-material/CardMembershipRounded';
import { useToast } from '@/components/ui/toast';
import { LiffSection, OptionCard } from '@/components/line/liff-ui';
import { formatDateDMY } from '@/lib/utils/date-format';
import type { LiffOwnedPackage, LiffPackagesView, ShopPackagesPublic } from '@/lib/packages/liff-view';
import {
  PACKAGE_STATUS_LABEL,
  formatPackageMinutes,
  packageChargeFor,
  packageCoversService,
  usageWindowsLabel,
  type PackageQueue,
} from '@/lib/packages/rules';

export type LiffMyPackage = LiffOwnedPackage;
export type LiffCatalogPackage = ShopPackagesPublic['catalog'][number];
export type LiffPackagesData = LiffPackagesView;

/**
 * Package section data. Built from what the page already loads — `base` =
 * `composeLiffPackages(/meta packages, /me packages)` — so opening LIFF makes
 * no package request. `reload()` asks `/packages` once, only after the
 * customer did something (bought, sent a slip, booked with a package); the
 * fresh copy wins until `base` changes again (next /me).
 */
export function useLiffPackages(shopKey: string, lineUserId: string, getIdToken: () => string, base: LiffPackagesView | null) {
  const [fresh, setFresh] = useState<LiffPackagesView | null>(null);
  useEffect(() => {
    setFresh(null);
  }, [base]);
  const reload = useCallback(async () => {
    if (!lineUserId) return;
    try {
      const res = await fetch(`/api/public/shop/${shopKey}/packages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ line_user_id: lineUserId, id_token: getIdToken() || undefined }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) setFresh(json.data as LiffPackagesView);
    } catch {
      // Packages are optional on this page; booking still works without them.
    }
    // getIdToken reads the live SDK token; it is not a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopKey, lineUserId]);
  return { data: fresh ?? base, reload };
}

/** A package that can pay for this order, with the minutes it would take. */
export type PackageChoice = { pkg: LiffMyPackage; minutes: number; enough: boolean; covered: boolean };

/**
 * Which of the caller's packages could pay for the order being built.
 *
 * @param mine - Caller's packages.
 * @param serviceId - Chosen service.
 * @param queues - Picked slots.
 */
export function packageChoicesFor(mine: readonly LiffMyPackage[], serviceId: string, queues: PackageQueue[]): PackageChoice[] {
  if (queues.length === 0) return [];
  return mine
    .filter((p) => p.usable && packageCoversService(p.service_ids, serviceId))
    .map((pkg) => {
      const charge = packageChargeFor(pkg.usage_windows ?? [], queues);
      const minutes = charge.ok ? charge.minutes : 0;
      return { pkg, minutes, covered: charge.ok, enough: charge.ok && minutes <= pkg.remaining_minutes };
    });
}

/**
 * "ชำระด้วยแพ็กเกจ" block on the LIFF booking step. Selecting one sends
 * `customer_package_id` with `/book` (no money is collected).
 */
export function LiffPackagePayPicker({
  choices,
  selectedId,
  onSelect,
}: {
  choices: PackageChoice[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  if (choices.length === 0) return null;
  return (
    <LiffSection title="ชำระด้วยแพ็กเกจ">
      {choices.map((c) => (
        <OptionCard
          key={c.pkg.id}
          icon={<CardMembershipRoundedIcon />}
          title={c.pkg.name}
          subtitle={
            !c.covered
              ? 'ใช้กับเวลาที่เลือกไม่ได้'
              : !c.enough
                ? `ชั่วโมงไม่พอ (ต้องใช้ ${formatPackageMinutes(c.minutes)} เหลือ ${formatPackageMinutes(c.pkg.remaining_minutes)})`
                : `ใช้ ${formatPackageMinutes(c.minutes)} · เหลือ ${formatPackageMinutes(c.pkg.remaining_minutes - c.minutes)}`
          }
          selected={selectedId === c.pkg.id}
          disabled={!c.enough}
          onClick={() => onSelect(selectedId === c.pkg.id ? '' : c.pkg.id)}
        />
      ))}
      <Typography variant="caption" color="text.secondary">แตะอีกครั้งเพื่อจ่ายแบบปกติ · ยกเลิกคิว = คืนชั่วโมงเข้าแพ็กเกจ</Typography>
    </LiffSection>
  );
}

/**
 * Member tab: the caller's packages (balance, expiry, pay / re-send slip) and
 * the packages the shop sells online (QR + slip, the shop approves).
 */
export function LiffPackagesPanel({
  shopKey,
  lineUserId,
  getIdToken,
  data,
  reload,
}: {
  shopKey: string;
  lineUserId: string;
  getIdToken: () => string;
  data: LiffPackagesData | null;
  reload: () => Promise<void>;
}) {
  const { push } = useToast();
  const [buying, setBuying] = useState('');
  const [uploading, setUploading] = useState('');
  const [openPay, setOpenPay] = useState('');

  if (!data || !data.enabled) return null;

  async function buy(pkg: LiffCatalogPackage) {
    setBuying(pkg.id);
    try {
      const res = await fetch(`/api/public/shop/${shopKey}/packages/buy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ package_id: pkg.id, line_user_id: lineUserId, id_token: getIdToken() || undefined }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return push(json.error ?? 'ซื้อแพ็กเกจไม่สำเร็จ', 'error');
      await reload();
      setOpenPay(String(json.data?.id ?? ''));
    } finally {
      setBuying('');
    }
  }

  async function uploadSlip(pkg: LiffMyPackage, e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(pkg.id);
    try {
      const form = new FormData();
      form.set('customer_package_id', pkg.id);
      form.set('line_user_id', lineUserId);
      form.set('id_token', getIdToken());
      form.set('file', file);
      const res = await fetch(`/api/public/shop/${shopKey}/packages/slip`, { method: 'POST', body: form });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return push(json.error ?? 'ส่งสลิปไม่สำเร็จ', 'error');
      push('ส่งสลิปแล้ว รอร้านตรวจสอบ ร้านจะแจ้งผลทาง LINE');
      setOpenPay('');
      await reload();
    } finally {
      setUploading('');
    }
  }

  const mine = data.mine.filter((p) => p.status !== 'cancelled');

  return (
    <>
      <LiffSection title="แพ็กเกจของฉัน" action={mine.length > 0 ? <Chip size="small" variant="outlined" label={`${mine.length}`} /> : undefined}>
        {mine.length === 0 ? <Typography variant="body2" color="text.secondary">ยังไม่มีแพ็กเกจ</Typography> : null}
        {mine.map((p) => {
          const payable = ['pending_payment', 'rejected'].includes(p.status);
          const showPay = payable && (openPay === p.id || p.status === 'rejected');
          return (
            <Box key={p.id} sx={{ border: 1, borderColor: 'divider', borderRadius: '16px', p: 1.5 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                <Typography sx={{ fontWeight: 700 }}>{p.name}</Typography>
                <Chip size="small" color={p.usable ? 'success' : p.status === 'active' ? 'default' : 'warning'} label={p.status === 'active' && !p.usable ? (p.remaining_minutes > 0 ? 'หมดอายุ' : 'ใช้หมดแล้ว') : PACKAGE_STATUS_LABEL[p.status] ?? p.status} />
              </Stack>
              {p.status === 'active' ? (
                <>
                  <Typography variant="body2" sx={{ mt: 0.5 }}>
                    คงเหลือ <b>{formatPackageMinutes(p.remaining_minutes)}</b> จาก {formatPackageMinutes(p.total_minutes)}
                  </Typography>
                  <LinearProgress variant="determinate" value={Math.min(100, (p.remaining_minutes / Math.max(1, p.total_minutes)) * 100)} sx={{ my: 0.75, borderRadius: 4, height: 6 }} />
                  <Typography variant="caption" color="text.secondary" display="block">
                    {p.expires_on ? `ใช้ได้ถึง ${formatDateDMY(p.expires_on)}` : 'ไม่หมดอายุ'} · {usageWindowsLabel(p.usage_windows ?? [])}
                  </Typography>
                </>
              ) : (
                <Typography variant="body2" sx={{ mt: 0.5 }}>{formatPackageMinutes(p.total_minutes)} · {Number(p.price_paid).toLocaleString('th-TH')} บาท</Typography>
              )}
              {p.status === 'awaiting_verification' ? <Alert severity="info" sx={{ mt: 1 }}>ส่งสลิปแล้ว รอร้านตรวจสอบ</Alert> : null}
              {p.status === 'rejected' && p.reject_reason ? <Alert severity="warning" sx={{ mt: 1 }}>สลิปไม่ผ่าน: {p.reject_reason}</Alert> : null}
              {payable && !showPay ? (
                <Button variant="contained" fullWidth sx={{ mt: 1 }} onClick={() => setOpenPay(p.id)}>ชำระเงิน / ส่งสลิป</Button>
              ) : null}
              {showPay ? (
                <Stack spacing={1} sx={{ mt: 1 }} alignItems="center">
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>สแกนจ่าย {Number(p.price_paid).toLocaleString('th-TH')} บาท</Typography>
                  {p.qr_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.qr_image_url} alt="QR พร้อมเพย์" style={{ width: 220, height: 220 }} />
                  ) : null}
                  {data.payee ? (
                    <Typography variant="caption" color="text.secondary" textAlign="center">
                      {[data.payee.name, data.payee.promptpay_masked ? `พร้อมเพย์ ${data.payee.promptpay_masked}` : '', data.payee.bank_name && data.payee.bank_account_no ? `${data.payee.bank_name} ${data.payee.bank_account_no}` : '']
                        .filter(Boolean)
                        .join(' · ')}
                    </Typography>
                  ) : null}
                  <Button variant="contained" component="label" fullWidth disabled={uploading === p.id}>
                    {uploading === p.id ? 'กำลังส่ง...' : 'อัปโหลดสลิป'}
                    <input hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => void uploadSlip(p, e)} />
                  </Button>
                </Stack>
              ) : null}
            </Box>
          );
        })}
      </LiffSection>

      {data.catalog.length > 0 ? (
        <LiffSection title="ซื้อแพ็กเกจ">
          {data.needs_member ? <Alert severity="info">บันทึกชื่อและเบอร์โทรด้านบน หรือจองคิวครั้งแรกก่อน จึงจะซื้อแพ็กเกจได้</Alert> : null}
          {!data.can_buy && !data.needs_member ? <Alert severity="info">ซื้อแพ็กเกจได้ที่หน้าร้าน</Alert> : null}
          {data.catalog.map((c) => (
            <Box key={c.id} sx={{ border: 1, borderColor: 'divider', borderRadius: '16px', p: 1.5 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="baseline" spacing={1}>
                <Typography sx={{ fontWeight: 700 }}>{c.name}</Typography>
                <Typography sx={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{Number(c.price).toLocaleString('th-TH')} บาท</Typography>
              </Stack>
              <Typography variant="body2">
                {formatPackageMinutes(c.credit_minutes)} · {c.valid_days ? `ใช้ได้ ${c.valid_days} วันนับจากร้านอนุมัติ` : 'ไม่หมดอายุ'}
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block">{usageWindowsLabel(c.usage_windows ?? [])}</Typography>
              {c.description ? <Typography variant="caption" color="text.secondary" display="block" sx={{ whiteSpace: 'pre-line' }}>{c.description}</Typography> : null}
              {data.can_buy ? (
                <Button variant="outlined" fullWidth sx={{ mt: 1 }} disabled={buying === c.id} onClick={() => void buy(c)}>
                  {buying === c.id ? 'กำลังสร้างรายการ...' : 'ซื้อแพ็กเกจนี้'}
                </Button>
              ) : null}
            </Box>
          ))}
        </LiffSection>
      ) : null}
    </>
  );
}
