'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  FormControlLabel,
  Link,
  MenuItem,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import TableChartRoundedIcon from '@mui/icons-material/TableChartRounded';
import { useToast } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/confirm-dialog';

type Source = {
  id: string;
  branch_id: string | null;
  spreadsheet_id: string;
  sheet_name: string | null;
  enabled: boolean;
  sheet_url: string;
};

type SheetState = {
  migrated: boolean;
  addon: { active: boolean; expires_on: string | null } | null;
  service_account_email: string;
  sources: Source[];
};

type TestResult = {
  ok: boolean;
  error: string | null;
  today: string;
  found: string[];
  today_count: number;
  skipped: Array<{ row: number; reason: string }>;
  skipped_count: number;
  preview: Array<{ queue_number: string; status: string; name: string | null; service: string | null; room: string | null; time: string | null; emergency: boolean }>;
};

type Branch = { id: string; branch_name: string };

const SHOP_WIDE = '';
const TEMPLATE_URL = '/templates/vet-queue-sheet-template.csv';
const GUIDE_URL = '/docs/sheet-signage-guide.html';

const STATUS_LABEL: Record<string, string> = {
  waiting: 'รอ',
  called: 'เรียก',
  serving: 'กำลังตรวจ',
  completed: 'เสร็จ',
};

/**
 * Add-on "จอคิวจาก Google Sheet": link a sheet to a display scope, test how it is
 * read, and switch the TV feed from bookings to the sheet. Shops without the
 * add-on see what it does and who to contact.
 */
export function SheetSourceCard() {
  const { push } = useToast();
  const confirm = useConfirm();
  const [state, setState] = useState<SheetState | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [branchId, setBranchId] = useState(SHOP_WIDE);
  const [sheetUrl, setSheetUrl] = useState('');
  const [sheetName, setSheetName] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [test, setTest] = useState<TestResult | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const sRes = await fetch('/api/signage-sheet', { cache: 'no-store' });
      const s = (await sRes.json()) as { data?: SheetState; error?: string };
      if (!sRes.ok || !s.data) throw new Error(s.error ?? 'โหลดการตั้งค่า Google Sheet ไม่สำเร็จ');
      setState(s.data);
      // Branches only feed the scope picker, which only exists for shops with the add-on.
      if (s.data.migrated && s.data.addon?.active) {
        const bRes = await fetch('/api/branches', { cache: 'no-store' });
        const b = (await bRes.json().catch(() => ({}))) as { data?: Branch[] };
        setBranches(b.data ?? []);
      }
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'โหลดไม่สำเร็จ');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Fill the form from the saved source of the chosen scope.
  useEffect(() => {
    const saved = state?.sources.find((s) => (s.branch_id ?? SHOP_WIDE) === branchId);
    setSheetUrl(saved?.sheet_url ?? '');
    setSheetName(saved?.sheet_name ?? '');
    setEnabled(Boolean(saved?.enabled));
    setTest(null);
  }, [state, branchId]);

  const saved = state?.sources.find((s) => (s.branch_id ?? SHOP_WIDE) === branchId) ?? null;
  const anyEnabled = state?.sources.some((s) => s.enabled) ?? false;

  async function runTest() {
    if (!sheetUrl.trim()) return;
    setTesting(true);
    try {
      const res = await fetch('/api/signage-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test', branch_id: branchId || null, sheet_url: sheetUrl, sheet_name: sheetName || null }),
      });
      const j = (await res.json()) as { data?: TestResult; error?: string };
      if (!res.ok || !j.data) throw new Error(j.error ?? 'ทดสอบไม่สำเร็จ');
      setTest(j.data);
    } catch (e) {
      push(e instanceof Error ? e.message : 'ทดสอบไม่สำเร็จ', 'error');
    } finally {
      setTesting(false);
    }
  }

  async function save() {
    if (enabled && !saved?.enabled) {
      const ok = await confirm({
        tone: 'warning',
        title: 'ให้จอคิวแสดงข้อมูลจาก Google Sheet?',
        description: 'จอ TV ของขอบเขตนี้จะเลิกแสดงคิวจากระบบจอง และแสดงเฉพาะแถวของวันนี้ใน Sheet แทน ปิดสวิตช์เมื่อไรก็กลับมาใช้คิวจากระบบจองได้',
        context: { primary: branchId ? branches.find((b) => b.id === branchId)?.branch_name ?? 'สาขา' : 'ทุกสาขา', secondary: sheetName || 'แท็บแรก' },
        confirmLabel: 'ใช้ข้อมูลจาก Sheet',
      });
      if (!ok) return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/signage-sheet', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branch_id: branchId || null, sheet_url: sheetUrl, sheet_name: sheetName || null, enabled }),
      });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(j.error ?? 'บันทึกไม่สำเร็จ');
      push(enabled ? 'บันทึกแล้ว จอจะเปลี่ยนเป็นข้อมูลจาก Sheet ในรอบรีเฟรชถัดไป' : 'บันทึกแล้ว', 'success');
      await load();
    } catch (e) {
      push(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function copyEmail() {
    if (!state?.service_account_email) return;
    try {
      await navigator.clipboard.writeText(state.service_account_email);
      push('คัดลอกอีเมลแล้ว', 'success');
    } catch {
      push('คัดลอกไม่สำเร็จ กรุณาเลือกข้อความแล้วคัดลอกเอง', 'error');
    }
  }

  const header = (
    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1.5 }}>
      <TableChartRoundedIcon color="success" />
      <Box sx={{ flex: 1 }}>
        <Typography variant="subtitle1" fontWeight={700}>จอคิวจาก Google Sheet</Typography>
        <Typography variant="caption" color="text.secondary">แพ็กเกจเสริม — จัดการคิวใน Google Sheet แล้วจอ TV แสดงตามทันที</Typography>
      </Box>
      <Chip size="small" color={anyEnabled ? 'success' : 'default'} label={anyEnabled ? 'กำลังใช้ Sheet' : 'ใช้คิวจากระบบจอง'} />
    </Stack>
  );

  // The card exists only for shops a super_admin switched the add-on on for.
  // Not migrated, not bought, expired, or the first load failed: render nothing.
  if (!state?.migrated || !state.addon?.active) return null;

  if (loadError) {
    return (
      <Card variant="outlined" sx={{ borderRadius: 2, mb: 2 }}>
        <CardContent>
          {header}
          <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => void load()}>ลองใหม่</Button>}>{loadError}</Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card variant="outlined" sx={{ borderRadius: 2, mb: 2 }}>
      <CardContent>
        {header}
        {state.addon.expires_on ? (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
            แพ็กเกจเสริมใช้ได้ถึง {state.addon.expires_on}
          </Typography>
        ) : null}

        <Stack spacing={2}>
          <TextField select size="small" label="ใช้กับจอของ" value={branchId} onChange={(e) => setBranchId(e.target.value)} sx={{ maxWidth: 360 }}>
            <MenuItem value={SHOP_WIDE}>ทุกสาขา (จอที่ไม่ได้ระบุสาขา)</MenuItem>
            {branches.map((b) => <MenuItem key={b.id} value={b.id}>{b.branch_name}</MenuItem>)}
          </TextField>

          <Box>
            <Typography variant="body2" fontWeight={600}>1. สร้าง Sheet จาก template</Typography>
            <Typography variant="body2" color="text.secondary">
              ดาวน์โหลดไฟล์แล้วนำเข้าใน Google Sheets (ไฟล์ → นำเข้า) — แถวแรกต้องเป็นชื่อคอลัมน์ คอลัมน์ &quot;สถานะ&quot; จำเป็น คอลัมน์ &quot;เบอร์โทร&quot; ไม่ถูกส่งขึ้นจอ
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
              <Button size="small" variant="outlined" startIcon={<DownloadRoundedIcon />} href={TEMPLATE_URL} download>ดาวน์โหลด template</Button>
              <Button size="small" variant="text" href={GUIDE_URL} target="_blank" rel="noopener">คู่มือตั้งค่า + สคริปต์ลงเวลาเรียก</Button>
            </Stack>
          </Box>

          <Box>
            <Typography variant="body2" fontWeight={600}>2. แชร์ Sheet ให้ระบบ (ผู้มีสิทธิ์อ่าน)</Typography>
            {state.service_account_email ? (
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                <Typography variant="body2" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>{state.service_account_email}</Typography>
                <Button size="small" startIcon={<ContentCopyRoundedIcon />} onClick={() => void copyEmail()}>คัดลอก</Button>
              </Stack>
            ) : (
              <Alert severity="warning" sx={{ mt: 0.5 }}>ระบบยังไม่ได้ตั้งค่าบัญชีเชื่อมต่อ Google กรุณาแจ้งทีมงาน</Alert>
            )}
            <Typography variant="caption" color="text.secondary">ไม่ต้องเปิด Sheet เป็นสาธารณะ — ข้อมูลเจ้าของสัตว์ยังเป็นส่วนตัว</Typography>
          </Box>

          <Box>
            <Typography variant="body2" fontWeight={600}>3. วางลิงก์ Sheet แล้วกดทดสอบ</Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 1 }}>
              <TextField size="small" fullWidth label="ลิงก์ Google Sheet" placeholder="https://docs.google.com/spreadsheets/d/…" value={sheetUrl} onChange={(e) => setSheetUrl(e.target.value)} />
              <TextField size="small" label="ชื่อแท็บ (ไม่บังคับ)" placeholder="แท็บแรก" value={sheetName} onChange={(e) => setSheetName(e.target.value)} sx={{ minWidth: 200 }} />
              <Button variant="outlined" disabled={testing || !sheetUrl.trim()} onClick={() => void runTest()} sx={{ whiteSpace: 'nowrap' }}>
                {testing ? <CircularProgress size={18} /> : 'ทดสอบ'}
              </Button>
            </Stack>
            {saved ? (
              <Link href={saved.sheet_url} target="_blank" rel="noopener" variant="caption">เปิด Sheet ที่บันทึกไว้</Link>
            ) : null}
          </Box>

          {test ? <TestResultView result={test} /> : null}

          <Box>
            <Typography variant="body2" fontWeight={600}>4. เปิดใช้กับจอ</Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }} sx={{ mt: 0.5 }}>
              <FormControlLabel
                control={<Switch checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />}
                label={enabled ? 'จอแสดงคิวจาก Google Sheet' : 'จอแสดงคิวจากระบบจอง (เดิม)'}
              />
              <Button variant="contained" disabled={saving || !sheetUrl.trim()} onClick={() => void save()}>
                {saving ? <CircularProgress size={18} color="inherit" /> : 'บันทึก'}
              </Button>
            </Stack>
            <Typography variant="caption" color="text.secondary">
              คิวใน Sheet ไม่ส่ง LINE ให้ลูกค้า และไม่นับรวมในรายงาน / โควตาของระบบจอง
            </Typography>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

/** What the test read: columns found, today's count, rows it could not read, first 10 rows. */
function TestResultView({ result }: { result: TestResult }) {
  if (!result.ok) return <Alert severity="error">{result.error ?? 'อ่าน Sheet ไม่สำเร็จ'}</Alert>;
  return (
    <Stack spacing={1}>
      <Alert severity={result.skipped_count > 0 ? 'warning' : 'success'}>
        อ่านได้ — คิววันนี้ ({result.today}) {result.today_count} รายการ · พบคอลัมน์ {result.found.length} คอลัมน์
        {result.skipped_count > 0 ? ` · มี ${result.skipped_count} แถวที่อ่านไม่ครบ` : ''}
      </Alert>
      {result.skipped.length > 0 ? (
        <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
          {result.skipped.map((s) => (
            <Typography key={`${s.row}-${s.reason}`} component="li" variant="caption" color="warning.main">แถว {s.row}: {s.reason}</Typography>
          ))}
        </Box>
      ) : null}
      {result.preview.length > 0 ? (
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>คิว</TableCell>
                <TableCell>ชื่อ</TableCell>
                <TableCell>แผนก</TableCell>
                <TableCell>ห้อง</TableCell>
                <TableCell>เวลา</TableCell>
                <TableCell>สถานะ</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {result.preview.map((p) => (
                <TableRow key={`${p.queue_number}-${p.name}`}>
                  <TableCell>{p.queue_number}</TableCell>
                  <TableCell>{p.name ?? '-'}</TableCell>
                  <TableCell>{p.service ?? '-'}</TableCell>
                  <TableCell>{p.room ?? '-'}</TableCell>
                  <TableCell>{p.time ?? '-'}</TableCell>
                  <TableCell>{p.emergency ? <Chip size="small" color="error" label="ฉุกเฉิน" sx={{ mr: 0.5 }} /> : null}{STATUS_LABEL[p.status] ?? p.status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      ) : null}
    </Stack>
  );
}
