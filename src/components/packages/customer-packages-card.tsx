'use client';

import { ChangeEvent, useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  IconButton,
  LinearProgress,
  MenuItem,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import AddShoppingCartRoundedIcon from '@mui/icons-material/AddShoppingCartRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { useToast } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { readPaywallDetail, useUpgrade } from '@/components/subscription/upgrade-provider';
import { formatDateDMY } from '@/lib/utils/date-format';
import { PACKAGE_STATUS_LABEL, formatPackageMinutes, parseUsageWindows, usageWindowsLabel, type PackageStatus } from '@/lib/packages/rules';
import type { PackageTemplate } from './package-templates-card';

type CustomerRef = { full_name?: string | null; nickname?: string | null; phone?: string | null } | null;
type Row = {
  id: string;
  customer_id: string;
  name: string;
  total_minutes: number;
  remaining_minutes: number;
  price_paid: number;
  expires_on: string | null;
  status: PackageStatus;
  source: string;
  payment_method: string | null;
  payment_note: string | null;
  reject_reason: string | null;
  usage_windows: unknown;
  created_at: string;
  customers: CustomerRef;
};
type Ledger = { id: string; kind: string; minutes: number; balance_after: number; note: string | null; created_at: string; bookings: { queue_number?: string; booking_date?: string; start_time?: string } | null };
type Slip = { id: string; status: string; url: string | null; reject_reason: string | null; created_at: string };
type Detail = Row & { ledger: Ledger[]; slips: Slip[] };
type Customer = { id: string; full_name: string; phone: string | null };

const STATUS_COLOR: Record<string, 'default' | 'success' | 'warning' | 'error' | 'info'> = {
  active: 'success',
  awaiting_verification: 'warning',
  pending_payment: 'info',
  rejected: 'error',
  cancelled: 'default',
};
const LEDGER_LABEL: Record<string, string> = { grant: 'เปิดใช้', redeem: 'ใช้จอง', refund: 'คืน (ยกเลิกคิว)', adjust: 'ปรับยอด', void: 'ยกเลิกแพ็กเกจ' };
const FILTERS: Array<{ value: string; label: string }> = [
  { value: 'awaiting_verification', label: 'รอตรวจสลิป' },
  { value: 'active', label: 'ใช้งานได้' },
  { value: '', label: 'ทั้งหมด' },
];

function customerLabel(c: CustomerRef): string {
  if (!c) return '-';
  return [c.full_name, c.nickname ? `(${c.nickname})` : '', c.phone].filter(Boolean).join(' ');
}

/**
 * Packages sold to customers: approve LIFF purchases (slip), sell at the
 * counter, adjust or cancel a balance, see every use. `/portal/packages`.
 *
 * @param props.templates - Current package templates (for the sell dialog).
 * @param props.initialId - Open this package's drawer first (`?id=` from a notification).
 */
export function CustomerPackagesCard({ templates, initialId }: { templates: PackageTemplate[]; initialId?: string | null }) {
  const { push } = useToast();
  const confirm = useConfirm();
  const { openPaywall } = useUpgrade();
  const [status, setStatus] = useState('awaiting_verification');
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [sellOpen, setSellOpen] = useState(false);
  const [customerOptions, setCustomerOptions] = useState<Customer[]>([]);
  const [sell, setSell] = useState<{ customer: Customer | null; packageId: string; price: string; method: string; note: string }>({ customer: null, packageId: '', price: '', method: 'cash', note: '' });
  const [busy, setBusy] = useState(false);
  const [adjust, setAdjust] = useState<{ hours: string; reason: string }>({ hours: '', reason: '' });
  /** Text input asked before reject / cancel (the confirm dialog has no text field). */
  const [reasonAsk, setReasonAsk] = useState<{ title: string; label: string; value: string; resolve: (v: string | null) => void } | null>(null);

  function askReason(title: string, label: string, value = ''): Promise<string | null> {
    return new Promise((resolve) => setReasonAsk({ title, label, value, resolve }));
  }

  function closeReason(value: string | null) {
    reasonAsk?.resolve(value && value.trim() ? value.trim() : null);
    setReasonAsk(null);
  }

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (q.trim()) params.set('q', q.trim());
    const res = await fetch(`/api/customer-packages?${params}`, { cache: 'no-store' });
    const json = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) return push(json.error ?? 'โหลดไม่สำเร็จ', 'error');
    setRows(json.data ?? []);
  }, [status, q, push]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 250);
    return () => clearTimeout(t);
  }, [load]);

  const openDetail = useCallback(async (id: string) => {
    const res = await fetch(`/api/customer-packages?id=${id}`, { cache: 'no-store' });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return push(json.error ?? 'โหลดไม่สำเร็จ', 'error');
    setAdjust({ hours: '', reason: '' });
    setDetail(json.data);
  }, [push]);

  useEffect(() => {
    if (initialId) void openDetail(initialId);
  }, [initialId, openDetail]);

  async function searchCustomers(text: string) {
    const res = await fetch(`/api/customers?page_size=20${text ? `&q=${encodeURIComponent(text)}` : ''}`, { cache: 'no-store' });
    if (!res.ok) return;
    const json = await res.json();
    setCustomerOptions(((json.data ?? []) as Array<Record<string, unknown>>).map((c) => ({ id: String(c.id), full_name: String(c.full_name ?? ''), phone: (c.phone as string | null) ?? null })));
  }

  async function action(body: Record<string, unknown>, success: string) {
    setBusy(true);
    const res = await fetch('/api/customer-packages', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      push(json.error ?? 'ทำรายการไม่สำเร็จ', 'error');
      return false;
    }
    push(success);
    if (detail) await openDetail(detail.id);
    await load();
    return true;
  }

  async function approve(row: Detail) {
    const ok = await confirm({
      tone: 'primary',
      title: 'อนุมัติแพ็กเกจนี้?',
      description: 'ตรวจยอดในสลิปให้ตรงกับราคาก่อน เมื่ออนุมัติ ลูกค้าใช้ชั่วโมงได้ทันทีและได้ข้อความแจ้งทาง LINE',
      context: { primary: `${row.name} · ${Number(row.price_paid).toLocaleString('th-TH')} บาท`, secondary: customerLabel(row.customers) },
      confirmLabel: 'อนุมัติแพ็กเกจ',
    });
    if (ok) await action({ id: row.id, action: 'approve' }, 'อนุมัติแล้ว');
  }

  async function reject(row: Detail) {
    const reason = await askReason('สลิปไม่ผ่าน', 'เหตุผล (ลูกค้าเห็นข้อความนี้)', 'ยอดเงินไม่ตรง');
    if (!reason) return;
    await action({ id: row.id, action: 'reject', reason }, 'แจ้งลูกค้าให้ส่งสลิปใหม่แล้ว');
  }

  async function cancelPackage(row: Detail) {
    const reason = await askReason('ยกเลิกแพ็กเกจ', 'เหตุผล (เช่น คืนเงินแล้ว)');
    if (!reason) return;
    const ok = await confirm({
      tone: 'error',
      title: 'ยกเลิกแพ็กเกจนี้?',
      description: `ชั่วโมงที่เหลือ ${formatPackageMinutes(row.remaining_minutes)} จะถูกตัดทิ้ง คิวที่จองด้วยแพ็กเกจนี้ไปแล้วยังอยู่ ระบบไม่คืนเงินให้อัตโนมัติ`,
      context: { primary: row.name, secondary: customerLabel(row.customers) },
      confirmLabel: 'ยกเลิกแพ็กเกจ',
      cancelLabel: 'ไม่ยกเลิก',
    });
    if (ok) await action({ id: row.id, action: 'cancel', reason }, 'ยกเลิกแพ็กเกจแล้ว');
  }

  async function submitAdjust(row: Detail) {
    const minutes = Math.round(Number(adjust.hours) * 60);
    if (!minutes) return push('ใส่จำนวนชั่วโมง (+ เพิ่ม / − ลด)', 'error');
    if (!adjust.reason.trim()) return push('ใส่เหตุผล', 'error');
    if (await action({ id: row.id, action: 'adjust', minutes, reason: adjust.reason.trim() }, 'ปรับยอดแล้ว')) setAdjust({ hours: '', reason: '' });
  }

  async function submitSell() {
    if (!sell.customer || !sell.packageId) return push('เลือกลูกค้าและแพ็กเกจ', 'error');
    setBusy(true);
    const res = await fetch('/api/customer-packages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_id: sell.customer.id,
        package_id: sell.packageId,
        price_paid: sell.price === '' ? undefined : Number(sell.price),
        payment_method: sell.method,
        payment_note: sell.note || null,
      }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    const paywall = readPaywallDetail(res, json);
    if (paywall) return openPaywall(paywall);
    if (!res.ok) return push(json.error ?? 'ขายไม่สำเร็จ', 'error');
    push('ขายแพ็กเกจแล้ว ลูกค้าใช้ได้ทันที');
    setSellOpen(false);
    setStatus('active');
    await load();
  }

  const sellable = templates.filter((t) => t.active);

  return (
    <Card>
      <CardContent>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} spacing={1.5} mb={2}>
          <Box>
            <Typography variant="h6" fontWeight={700}>แพ็กเกจของลูกค้า</Typography>
            <Typography variant="body2" color="text.secondary">ตรวจสลิปที่ลูกค้าซื้อใน LINE หรือขายที่หน้าร้าน (รับเงินแล้วใช้ได้ทันที)</Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<AddShoppingCartRoundedIcon />}
            disabled={sellable.length === 0}
            onClick={() => {
              setSell({ customer: null, packageId: sellable[0]?.id ?? '', price: '', method: 'cash', note: '' });
              void searchCustomers('');
              setSellOpen(true);
            }}
          >
            ขายแพ็กเกจที่ร้าน
          </Button>
        </Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} mb={1.5}>
          <ToggleButtonGroup size="small" exclusive value={status} onChange={(_, v) => v !== null && setStatus(v)}>
            {FILTERS.map((f) => <ToggleButton key={f.value || 'all'} value={f.value}>{f.label}</ToggleButton>)}
          </ToggleButtonGroup>
          <TextField size="small" placeholder="ค้นหาชื่อ / เบอร์ / แพ็กเกจ" value={q} onChange={(e: ChangeEvent<HTMLInputElement>) => setQ(e.target.value)} sx={{ flex: 1 }} />
        </Stack>
        {loading ? <LinearProgress sx={{ mb: 1 }} /> : null}
        {!loading && rows.length === 0 ? <Typography variant="body2" color="text.secondary">ไม่มีรายการ</Typography> : null}
        <Stack spacing={1}>
          {rows.map((r) => (
            <Box
              key={r.id}
              onClick={() => void openDetail(r.id)}
              sx={{ border: 1, borderColor: 'divider', borderRadius: 2, p: 1.5, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
            >
              <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="center">
                <Box sx={{ minWidth: 0 }}>
                  <Typography fontWeight={600} noWrap>{customerLabel(r.customers)}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {r.name} · เหลือ {formatPackageMinutes(r.remaining_minutes)} / {formatPackageMinutes(r.total_minutes)}
                    {r.expires_on ? ` · ถึง ${formatDateDMY(r.expires_on)}` : ''}
                  </Typography>
                </Box>
                <Chip size="small" color={STATUS_COLOR[r.status] ?? 'default'} label={PACKAGE_STATUS_LABEL[r.status] ?? r.status} />
              </Stack>
            </Box>
          ))}
        </Stack>
      </CardContent>

      <Dialog open={sellOpen} onClose={() => setSellOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>ขายแพ็กเกจที่ร้าน</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Alert severity="info">ใช้เมื่อรับเงินแล้ว (เงินสด / โอน) — แพ็กเกจเปิดใช้ทันที</Alert>
            <Autocomplete
              options={customerOptions}
              value={sell.customer}
              onChange={(_, v) => setSell((s) => ({ ...s, customer: v }))}
              onInputChange={(_, text, reason) => reason === 'input' && void searchCustomers(text)}
              getOptionLabel={(c) => `${c.full_name}${c.phone ? ` ${c.phone}` : ''}`}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              filterOptions={(x) => x}
              renderInput={(params) => <TextField {...params} label="ลูกค้า" size="small" placeholder="พิมพ์ชื่อหรือเบอร์" />}
            />
            <TextField select size="small" label="แพ็กเกจ" value={sell.packageId} onChange={(e) => setSell((s) => ({ ...s, packageId: e.target.value, price: '' }))}>
              {sellable.map((t) => (
                <MenuItem key={t.id} value={t.id}>{t.name} — {formatPackageMinutes(t.credit_minutes)} · {Number(t.price).toLocaleString('th-TH')} บาท</MenuItem>
              ))}
            </TextField>
            <Stack direction="row" spacing={1.5}>
              <TextField
                size="small"
                type="number"
                label="ราคาที่รับจริง (บาท)"
                value={sell.price}
                placeholder={String(sellable.find((t) => t.id === sell.packageId)?.price ?? '')}
                onChange={(e) => setSell((s) => ({ ...s, price: e.target.value }))}
                helperText="ว่าง = ราคาแพ็กเกจ"
                sx={{ flex: 1 }}
              />
              <TextField select size="small" label="รับเงินโดย" value={sell.method} onChange={(e) => setSell((s) => ({ ...s, method: e.target.value }))} sx={{ flex: 1 }}>
                <MenuItem value="cash">เงินสด</MenuItem>
                <MenuItem value="bank_transfer">โอนเงิน</MenuItem>
                <MenuItem value="other">อื่น ๆ</MenuItem>
              </TextField>
            </Stack>
            <TextField size="small" label="หมายเหตุ (ไม่บังคับ)" value={sell.note} onChange={(e) => setSell((s) => ({ ...s, note: e.target.value }))} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSellOpen(false)}>ยกเลิก</Button>
          <Button variant="contained" onClick={() => void submitSell()} disabled={busy}>บันทึกการขาย</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(reasonAsk)} onClose={() => closeReason(null)} fullWidth maxWidth="xs">
        <DialogTitle>{reasonAsk?.title}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            size="small"
            sx={{ mt: 1 }}
            label={reasonAsk?.label}
            value={reasonAsk?.value ?? ''}
            onChange={(e) => setReasonAsk((r) => (r ? { ...r, value: e.target.value } : r))}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => closeReason(null)}>ปิด</Button>
          <Button variant="contained" disabled={!reasonAsk?.value.trim()} onClick={() => closeReason(reasonAsk?.value ?? null)}>ถัดไป</Button>
        </DialogActions>
      </Dialog>

      <Drawer anchor="right" open={Boolean(detail)} onClose={() => setDetail(null)} PaperProps={{ sx: { width: { xs: '100%', sm: 480 }, p: 2.5 } }}>
        {detail ? (
          <Stack spacing={2}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="h6" fontWeight={700}>{detail.name}</Typography>
              <IconButton aria-label="ปิด" onClick={() => setDetail(null)}><CloseRoundedIcon /></IconButton>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip size="small" color={STATUS_COLOR[detail.status] ?? 'default'} label={PACKAGE_STATUS_LABEL[detail.status] ?? detail.status} />
              <Typography variant="body2" color="text.secondary">{detail.source === 'liff' ? 'ลูกค้าซื้อใน LINE' : 'ขายที่ร้าน'}</Typography>
            </Stack>
            <Box>
              <Typography variant="body2">ลูกค้า: {customerLabel(detail.customers)}</Typography>
              <Typography variant="body2">ราคา: {Number(detail.price_paid).toLocaleString('th-TH')} บาท{detail.payment_note ? ` · ${detail.payment_note}` : ''}</Typography>
              <Typography variant="body2">คงเหลือ: <b>{formatPackageMinutes(detail.remaining_minutes)}</b> จาก {formatPackageMinutes(detail.total_minutes)}</Typography>
              <Typography variant="body2">ใช้ได้ถึง: {detail.expires_on ? formatDateDMY(detail.expires_on) : detail.status === 'active' ? 'ไม่หมดอายุ' : 'นับจากวันที่อนุมัติ'}</Typography>
              <Typography variant="caption" color="text.secondary">{usageWindowsLabel(parseUsageWindows(detail.usage_windows))}</Typography>
              {detail.reject_reason ? <Alert severity="warning" sx={{ mt: 1 }}>{detail.reject_reason}</Alert> : null}
            </Box>

            {detail.slips.length > 0 ? (
              <Box>
                <Typography variant="subtitle2" mb={1}>สลิป</Typography>
                <Stack spacing={1}>
                  {detail.slips.map((s) => (
                    <Box key={s.id} sx={{ border: 1, borderColor: 'divider', borderRadius: 2, p: 1 }}>
                      <Typography variant="caption" color="text.secondary">{new Date(s.created_at).toLocaleString('th-TH')} · {s.status}</Typography>
                      {s.url ? (
                        <a href={s.url} target="_blank" rel="noreferrer">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={s.url} alt="สลิป" style={{ display: 'block', width: '100%', maxHeight: 360, objectFit: 'contain', marginTop: 4 }} />
                        </a>
                      ) : null}
                    </Box>
                  ))}
                </Stack>
              </Box>
            ) : null}

            {['awaiting_verification', 'pending_payment'].includes(detail.status) ? (
              <Stack direction="row" spacing={1}>
                <Button variant="contained" color="success" disabled={busy} onClick={() => void approve(detail)}>อนุมัติ (รับเงินแล้ว)</Button>
                <Button variant="outlined" color="error" disabled={busy} onClick={() => void reject(detail)}>สลิปไม่ผ่าน</Button>
              </Stack>
            ) : null}

            {detail.status === 'active' ? (
              <Box>
                <Typography variant="subtitle2" mb={1}>ปรับยอดชั่วโมง</Typography>
                <Stack direction="row" spacing={1}>
                  <TextField size="small" type="number" label="ชั่วโมง (+/−)" value={adjust.hours} onChange={(e) => setAdjust((a) => ({ ...a, hours: e.target.value }))} sx={{ width: 130 }} slotProps={{ htmlInput: { step: 0.5 } }} />
                  <TextField size="small" label="เหตุผล" value={adjust.reason} onChange={(e) => setAdjust((a) => ({ ...a, reason: e.target.value }))} sx={{ flex: 1 }} />
                  <Button variant="outlined" disabled={busy} onClick={() => void submitAdjust(detail)}>ปรับ</Button>
                </Stack>
              </Box>
            ) : null}

            {detail.status !== 'cancelled' ? (
              <Box>
                <Button color="error" size="small" disabled={busy} onClick={() => void cancelPackage(detail)}>ยกเลิกแพ็กเกจ</Button>
              </Box>
            ) : null}

            <Divider />
            <Typography variant="subtitle2">ประวัติการใช้</Typography>
            {detail.ledger.length === 0 ? <Typography variant="body2" color="text.secondary">ยังไม่มี</Typography> : null}
            <Stack spacing={0.75}>
              {detail.ledger.map((l) => (
                <Stack key={l.id} direction="row" justifyContent="space-between" spacing={1}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2">
                      {LEDGER_LABEL[l.kind] ?? l.kind}
                      {l.bookings?.queue_number ? ` · คิว ${l.bookings.queue_number} ${l.bookings.booking_date ? formatDateDMY(l.bookings.booking_date) : ''} ${String(l.bookings.start_time ?? '').slice(0, 5)}` : ''}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">{new Date(l.created_at).toLocaleString('th-TH')}{l.note ? ` · ${l.note}` : ''}</Typography>
                  </Box>
                  <Box sx={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <Typography variant="body2" fontWeight={700} color={l.minutes < 0 ? 'error.main' : 'success.main'}>
                      {l.minutes < 0 ? '−' : '+'}{formatPackageMinutes(Math.abs(l.minutes))}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">เหลือ {formatPackageMinutes(l.balance_after)}</Typography>
                  </Box>
                </Stack>
              ))}
            </Stack>
          </Stack>
        ) : null}
      </Drawer>
    </Card>
  );
}
