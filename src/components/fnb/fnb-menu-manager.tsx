'use client';

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Drawer,
  FormControlLabel,
  IconButton,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { useToast } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { ImageUploader } from '@/components/forms/image-uploader';
import { readPaywallDetail, useUpgrade } from '@/components/subscription/upgrade-provider';

type MenuItem = {
  id: string;
  category: string;
  item_name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_available: boolean;
  active: boolean;
  sort_order: number;
};

type Access = { fnb_enabled: boolean; plan_allowed: boolean; enabled: boolean };

type Draft = {
  id: string | null;
  category: string;
  item_name: string;
  description: string;
  price: string;
  image_url: string;
  sort_order: string;
  active: boolean;
};

const EMPTY_DRAFT: Draft = { id: null, category: 'ทั่วไป', item_name: '', description: '', price: '', image_url: '', sort_order: '0', active: true };

/**
 * Portal: F&B on/off switch (Professional+) and the menu editor.
 * The switch saves on its own; menu rows save through the drawer.
 */
export function FnbMenuManager() {
  const { push } = useToast();
  const confirm = useConfirm();
  const { openPaywall, openUpgrade } = useUpgrade();
  const [access, setAccess] = useState<Access | null>(null);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingSwitch, setSavingSwitch] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);

  const load = useCallback(async () => {
    setLoading(true);
    const [resAccess, resMenu] = await Promise.all([
      fetch('/api/fnb-settings', { cache: 'no-store' }),
      fetch('/api/fnb-menu', { cache: 'no-store' }),
    ]);
    const [a, m] = await Promise.all([resAccess.json(), resMenu.json()]);
    if (resAccess.ok) setAccess(a.data as Access);
    if (resMenu.ok) setItems((m.data ?? []) as MenuItem[]);
    else push(m.error ?? 'โหลดเมนูไม่สำเร็จ', 'error');
    setLoading(false);
  }, [push]);

  useEffect(() => {
    void load();
  }, [load]);

  const grouped = useMemo(() => {
    const map = new Map<string, MenuItem[]>();
    for (const item of items) map.set(item.category, [...(map.get(item.category) ?? []), item]);
    return Array.from(map.entries());
  }, [items]);

  /** Commit-on-toggle, reverting if the server refuses (e.g. plan below Professional). */
  async function onToggleSwitch(next: boolean) {
    setSavingSwitch(true);
    const res = await fetch('/api/fnb-settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fnb_enabled: next }),
    });
    const json = await res.json();
    setSavingSwitch(false);
    if (!res.ok) {
      const paywall = readPaywallDetail(res, json);
      if (paywall) return openPaywall(paywall);
      return push(json.error ?? 'บันทึกการตั้งค่าไม่สำเร็จ', 'error');
    }
    setAccess((prev) => (prev ? { ...prev, fnb_enabled: next, enabled: next && prev.plan_allowed } : prev));
    push(next ? 'เปิดสั่งอาหารผ่าน LINE แล้ว' : 'ปิดสั่งอาหารผ่าน LINE แล้ว');
  }

  function openCreate() {
    setDraft({ ...EMPTY_DRAFT, category: grouped[grouped.length - 1]?.[0] ?? 'ทั่วไป' });
    setDrawerOpen(true);
  }

  function openEdit(item: MenuItem) {
    setDraft({
      id: item.id,
      category: item.category,
      item_name: item.item_name,
      description: item.description ?? '',
      price: String(item.price),
      image_url: item.image_url ?? '',
      sort_order: String(item.sort_order),
      active: item.active,
    });
    setDrawerOpen(true);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    const original = items.find((i) => i.id === draft.id);
    const res = await fetch('/api/fnb-menu', {
      method: draft.id ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: draft.id ?? undefined,
        category: draft.category,
        item_name: draft.item_name,
        description: draft.description,
        price: draft.price,
        image_url: draft.image_url,
        sort_order: draft.sort_order,
        active: draft.active,
        is_available: original?.is_available ?? true,
      }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) {
      const paywall = readPaywallDetail(res, json);
      if (paywall) return openPaywall(paywall);
      return push(json.error ?? 'บันทึกเมนูไม่สำเร็จ', 'error');
    }
    push('บันทึกเมนูแล้ว');
    setDrawerOpen(false);
    await load();
  }

  /** "Sold out" for today — a one-tap action that stays available even on a lapsed plan. */
  async function onToggleAvailable(item: MenuItem, next: boolean) {
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, is_available: next } : i)));
    const res = await fetch('/api/fnb-menu', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.id, is_available: next }),
    });
    if (!res.ok) {
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, is_available: !next } : i)));
      const json = await res.json().catch(() => ({}));
      push((json as { error?: string }).error ?? 'บันทึกไม่สำเร็จ', 'error');
    }
  }

  async function onDelete(item: MenuItem) {
    const ok = await confirm({
      tone: 'error',
      title: 'ลบเมนูนี้?',
      description: 'ลูกค้าจะสั่งเมนูนี้ไม่ได้อีก ออเดอร์ที่สั่งไปแล้วยังอยู่ครบ',
      context: { primary: item.item_name, secondary: `${item.price.toLocaleString('th-TH')} บาท` },
      confirmLabel: 'ลบเมนู',
    });
    if (!ok) return;
    const res = await fetch(`/api/fnb-menu?id=${item.id}`, { method: 'DELETE' });
    const json = await res.json();
    if (!res.ok) return push(json.error ?? 'ลบเมนูไม่สำเร็จ', 'error');
    push('ลบเมนูแล้ว');
    await load();
  }

  const locked = access ? !access.plan_allowed : false;

  return (
    <Stack spacing={2}>
      {locked ? (
        <Alert
          severity="info"
          action={
            <Button color="inherit" size="small" onClick={() => openUpgrade('portal')}>
              ดูแพ็กเกจ
            </Button>
          }
        >
          สั่งอาหารเครื่องดื่มผ่าน LINE ใช้ได้ตั้งแต่แพ็กเกจ Professional ขึ้นไป
        </Alert>
      ) : null}

      <Card>
        <CardContent>
          <FormControlLabel
            control={
              <Switch
                checked={Boolean(access?.fnb_enabled) && !locked}
                disabled={!access || savingSwitch || locked}
                onChange={(e: ChangeEvent<HTMLInputElement>) => void onToggleSwitch(e.target.checked)}
              />
            }
            label="เปิดให้ลูกค้าสั่งอาหารเครื่องดื่มผ่าน LINE"
          />
          <Typography variant="caption" color="text.secondary" display="block">
            เมื่อเปิด ลูกค้าที่เช็คอินแล้วจะเห็นปุ่ม “สั่งอาหาร” ในหน้าคิวของฉัน และพนักงานเห็นออเดอร์ที่หน้า “ออเดอร์อาหาร” (ตั้งค่านี้ใช้ทั้งร้าน)
          </Typography>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
            <Box>
              <Typography variant="subtitle1" fontWeight={600}>เมนู ({items.length})</Typography>
              <Typography variant="caption" color="text.secondary">กดสวิตช์ “พร้อมขาย” เพื่อปิดเมนูที่หมดวันนี้ได้ทันที</Typography>
            </Box>
            <Button startIcon={<AddRoundedIcon />} variant="contained" onClick={openCreate} disabled={locked} sx={{ minHeight: { xs: 44, sm: 'auto' } }}>
              เพิ่มเมนู
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {loading ? (
        <Typography color="text.secondary">กำลังโหลด…</Typography>
      ) : items.length === 0 ? (
        <EmptyState title="ยังไม่มีเมนู" description="เพิ่มเมนูแรกเพื่อเริ่มรับออเดอร์จากลูกค้า" />
      ) : (
        grouped.map(([category, list]) => (
          <Card key={category}>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>{category}</Typography>
              <Stack divider={<Box sx={{ borderTop: 1, borderColor: 'divider' }} />}>
                {list.map((item) => (
                  <Stack key={item.id} direction="row" alignItems="center" spacing={1.5} sx={{ py: 1.25 }}>
                    {item.image_url ? (
                      <Box component="img" src={item.image_url} alt="" sx={{ width: 48, height: 48, borderRadius: 1, objectFit: 'cover', flexShrink: 0 }} />
                    ) : null}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                        <Typography fontWeight={600} noWrap>{item.item_name}</Typography>
                        {!item.active ? <Chip size="small" label="ซ่อน" /> : null}
                      </Stack>
                      <Typography variant="body2" color="text.secondary">{item.price.toLocaleString('th-TH')} บาท</Typography>
                    </Box>
                    <FormControlLabel
                      sx={{ m: 0 }}
                      control={<Switch size="small" checked={item.is_available} onChange={(e) => void onToggleAvailable(item, e.target.checked)} />}
                      label={<Typography variant="caption">พร้อมขาย</Typography>}
                    />
                    <IconButton aria-label="แก้ไข" onClick={() => openEdit(item)} disabled={locked}><EditOutlinedIcon fontSize="small" /></IconButton>
                    <IconButton aria-label="ลบ" onClick={() => void onDelete(item)}><DeleteOutlineIcon fontSize="small" /></IconButton>
                  </Stack>
                ))}
              </Stack>
            </CardContent>
          </Card>
        ))
      )}

      <Drawer anchor="right" open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <Box component="form" onSubmit={onSubmit} sx={{ width: { xs: '100vw', sm: 420 }, p: 3 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Typography variant="h6">{draft.id ? 'แก้ไขเมนู' : 'เพิ่มเมนู'}</Typography>
            <IconButton aria-label="ปิด" onClick={() => setDrawerOpen(false)}><CloseRoundedIcon /></IconButton>
          </Stack>
          <Stack spacing={2}>
            <TextField label="ชื่อเมนู" required value={draft.item_name} onChange={(e) => setDraft({ ...draft, item_name: e.target.value })} inputProps={{ maxLength: 120 }} />
            <TextField label="หมวด" required value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} helperText="เช่น เครื่องดื่ม, อาหารจานเดียว, ของทานเล่น" inputProps={{ maxLength: 60 }} />
            <TextField label="ราคา (บาท)" required type="number" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} inputProps={{ min: 0, step: '0.01' }} />
            <TextField label="รายละเอียด" multiline minRows={2} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} inputProps={{ maxLength: 500 }} />
            <TextField label="ลำดับแสดง" type="number" value={draft.sort_order} onChange={(e) => setDraft({ ...draft, sort_order: e.target.value })} inputProps={{ min: 0 }} helperText="เลขน้อยแสดงก่อน" />
            <ImageUploader
              kind="menu"
              value={draft.image_url ? [draft.image_url] : []}
              onChange={(next) => setDraft({ ...draft, image_url: next[0] ?? '' })}
              label="รูปเมนู"
              hint="ลูกค้าเห็นรูปนี้ตอนเลือกสั่งใน LINE"
            />
            <FormControlLabel control={<Switch checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} />} label="แสดงในเมนู" />
            <Button type="submit" variant="contained" disabled={saving} sx={{ minHeight: 44 }}>
              {saving ? 'กำลังบันทึก…' : 'บันทึก'}
            </Button>
          </Stack>
        </Box>
      </Drawer>
    </Stack>
  );
}
