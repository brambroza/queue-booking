'use client';

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  Typography,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material/Select';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { useToast } from '@/components/ui/toast';
import { BookingModeChip } from '@/components/shared/booking-mode-chip';
import { ActionIconGroup } from '@/components/ui/action-icon-group';

type Service = Record<string, unknown>;
type Template = {
  id: string;
  business_category: string;
  service_name: string;
  booking_mode: 'fixed_slot' | 'flexible_duration' | 'capacity_based' | 'walk_in' | 'request_approval';
  duration_minutes: number | null;
  min_duration_minutes: number | null;
  max_duration_minutes: number | null;
  capacity_per_slot: number | null;
  requires_approval: boolean;
  allow_walk_in: boolean;
};

const BOOKING_MODES = ['fixed_slot', 'flexible_duration', 'capacity_based', 'walk_in', 'request_approval'] as const;

export function ServicesCrud() {
  const { push } = useToast();
  const [rows, setRows] = useState<Service[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const [serviceName, setServiceName] = useState('');
  const [bookingMode, setBookingMode] = useState<Template['booking_mode']>('fixed_slot');
  const [duration, setDuration] = useState('30');
  const [minDuration, setMinDuration] = useState('90');
  const [maxDuration, setMaxDuration] = useState('180');
  const [capacity, setCapacity] = useState('1');
  const [price, setPrice] = useState('0');
  const [active, setActive] = useState(true);
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [allowWalkIn, setAllowWalkIn] = useState(false);
  const [category, setCategory] = useState('');

  const categories = useMemo(() => Array.from(new Set(templates.map((t) => t.business_category))).sort(), [templates]);
  const filteredTemplates = useMemo(() => (category ? templates.filter((t) => t.business_category === category) : templates), [templates, category]);
  const pagedRows = useMemo(() => rows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage), [rows, page, rowsPerPage]);

  async function load() {
    const [resServices, resTemplates] = await Promise.all([
      fetch('/api/services', { cache: 'no-store' }),
      fetch('/api/service-templates', { cache: 'no-store' }),
    ]);
    const [s, t] = await Promise.all([resServices.json(), resTemplates.json()]);
    if (!resServices.ok) return push(s.error ?? 'โหลด services ไม่สำเร็จ', 'error');
    if (!resTemplates.ok) return push(t.error ?? 'โหลด templates ไม่สำเร็จ', 'error');
    setRows(s.data ?? []);
    setTemplates(t.data ?? []);
  }

  useEffect(() => { void load(); }, []);

  function applyTemplate(t: Template) {
    setServiceName(t.service_name);
    setBookingMode(t.booking_mode);
    setDuration(String(t.duration_minutes ?? 30));
    setMinDuration(String(t.min_duration_minutes ?? 60));
    setMaxDuration(String(t.max_duration_minutes ?? 120));
    setCapacity(String(t.capacity_per_slot ?? 1));
    setRequiresApproval(Boolean(t.requires_approval));
    setAllowWalkIn(Boolean(t.allow_walk_in));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      service_name: serviceName,
      booking_mode: bookingMode,
      duration_minutes: bookingMode === 'fixed_slot' ? Number(duration) : null,
      min_duration_minutes: bookingMode === 'flexible_duration' ? Number(minDuration) : null,
      max_duration_minutes: bookingMode === 'flexible_duration' ? Number(maxDuration) : null,
      capacity_per_slot: Number(capacity) || 1,
      price: Number(price) || 0,
      requires_approval: bookingMode === 'request_approval' ? true : requiresApproval,
      allow_walk_in: bookingMode === 'walk_in' ? true : allowWalkIn,
      active,
    };
    const res = await fetch('/api/services', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) return push(json.error ?? 'เพิ่มบริการไม่สำเร็จ', 'error');
    push('เพิ่มบริการสำเร็จ');
    setDrawerOpen(false);
    await load();
  }

  async function onDelete() {
    if (!deleteId) return;
    const res = await fetch(`/api/services?id=${deleteId}`, { method: 'DELETE' });
    const json = await res.json();
    if (!res.ok) return push(json.error ?? 'ลบไม่สำเร็จ', 'error');
    push('ลบบริการแล้ว');
    setDeleteId(null);
    await load();
  }

  return (
    <Stack spacing={2}>
      <Card>
        <CardContent>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Box>
              <Typography variant="h6" fontWeight={700}>Service Management</Typography>
              <Typography variant="body2" color="text.secondary">Business category, templates and booking modes</Typography>
            </Box>
            <Button startIcon={<AddRoundedIcon />} variant="contained" onClick={() => setDrawerOpen(true)}>Add Service</Button>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent sx={{ p: 0 }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Service</TableCell>
                <TableCell>Mode</TableCell>
                <TableCell>Duration</TableCell>
                <TableCell>Capacity</TableCell>
                <TableCell>Price</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow><TableCell colSpan={7}>No service found</TableCell></TableRow>
              ) : pagedRows.map((r) => (
                <TableRow key={String(r.id)} hover>
                  <TableCell sx={{ fontWeight: 600 }}>{String(r.service_name)}</TableCell>
                  <TableCell><BookingModeChip mode={String(r.booking_mode ?? 'fixed_slot')} /></TableCell>
                  <TableCell>
                    {r.booking_mode === 'flexible_duration'
                      ? `${String(r.min_duration_minutes ?? '-')} - ${String(r.max_duration_minutes ?? '-')} min`
                      : `${String(r.duration_minutes ?? '-')}${r.duration_minutes ? ' min' : ''}`}
                  </TableCell>
                  <TableCell>{String(r.capacity_per_slot ?? 1)}</TableCell>
                  <TableCell>{String(r.price ?? 0)}</TableCell>
                  <TableCell><Chip size="small" color={Boolean(r.active) ? 'success' : 'default'} label={Boolean(r.active) ? 'active' : 'inactive'} /></TableCell>
                  <TableCell align="right">
                    <ActionIconGroup
                      actions={[
                        {
                          key: 'delete',
                          icon: <DeleteOutlineIcon fontSize="small" />,
                          labelKey: 'common.delete',
                          fallbackLabel: 'Delete',
                          color: 'error',
                          onClick: () => setDeleteId(String(r.id)),
                        },
                      ]}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <TablePagination
            component="div"
            count={rows.length}
            page={page}
            onPageChange={(_, nextPage) => setPage(nextPage)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(Number(e.target.value));
              setPage(0);
            }}
            rowsPerPageOptions={[10, 20, 50, 100]}
          />
        </CardContent>
      </Card>

      <Drawer anchor="right" open={drawerOpen} onClose={() => setDrawerOpen(false)} PaperProps={{ sx: { width: { xs: '100%', sm: '60%' }, p: 3 } }}>
        <Typography variant="h6" fontWeight={700} mb={2}>Add Service</Typography>

        <Card variant="outlined" sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="subtitle2" mb={1}>Service Templates</Typography>
            <Grid container spacing={1.2}>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Business Category</InputLabel>
                  <Select value={category} label="Business Category" onChange={(e: SelectChangeEvent) => setCategory(String(e.target.value))}>
                    <MenuItem value="">All</MenuItem>
                    {categories.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Template</InputLabel>
                  <Select value="" label="Template" onChange={(e: SelectChangeEvent) => {
                    const t = templates.find((x) => x.id === e.target.value);
                    if (t) applyTemplate(t);
                  }}>
                    <MenuItem value="">Select template</MenuItem>
                    {filteredTemplates.map((t) => (
                      <MenuItem key={t.id} value={t.id}>{t.business_category} • {t.service_name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        <Box component="form" onSubmit={onSubmit}>
          <Grid container spacing={1.5}>
            <Grid item xs={12}>
              <TextField label="Service Name" value={serviceName} onChange={(e: ChangeEvent<HTMLInputElement>) => setServiceName(e.target.value)} fullWidth size="small" required />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Booking Mode</InputLabel>
                <Select value={bookingMode} label="Booking Mode" onChange={(e: SelectChangeEvent) => setBookingMode(e.target.value as Template['booking_mode'])}>
                  {BOOKING_MODES.map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField label="Price" type="number" value={price} onChange={(e: ChangeEvent<HTMLInputElement>) => setPrice(e.target.value)} fullWidth size="small" />
            </Grid>

            {bookingMode === 'fixed_slot' ? (
              <Grid item xs={12} sm={6}><TextField label="Duration Minutes" type="number" value={duration} onChange={(e: ChangeEvent<HTMLInputElement>) => setDuration(e.target.value)} fullWidth size="small" /></Grid>
            ) : null}
            {bookingMode === 'flexible_duration' ? (
              <>
                <Grid item xs={12} sm={6}><TextField label="Min Duration" type="number" value={minDuration} onChange={(e: ChangeEvent<HTMLInputElement>) => setMinDuration(e.target.value)} fullWidth size="small" /></Grid>
                <Grid item xs={12} sm={6}><TextField label="Max Duration" type="number" value={maxDuration} onChange={(e: ChangeEvent<HTMLInputElement>) => setMaxDuration(e.target.value)} fullWidth size="small" /></Grid>
              </>
            ) : null}
            <Grid item xs={12} sm={6}><TextField label="Capacity / Slot" type="number" value={capacity} onChange={(e: ChangeEvent<HTMLInputElement>) => setCapacity(e.target.value)} fullWidth size="small" /></Grid>

            <Grid item xs={12} sm={6}><FormControlLabel control={<Switch checked={active} onChange={(e: ChangeEvent<HTMLInputElement>) => setActive(e.target.checked)} />} label="Active" /></Grid>
            <Grid item xs={12} sm={6}><FormControlLabel control={<Switch checked={requiresApproval} onChange={(e: ChangeEvent<HTMLInputElement>) => setRequiresApproval(e.target.checked)} />} label="Require Staff Confirm" /></Grid>
            <Grid item xs={12} sm={6}><FormControlLabel control={<Switch checked={allowWalkIn} onChange={(e: ChangeEvent<HTMLInputElement>) => setAllowWalkIn(e.target.checked)} />} label="Allow Walk-in" /></Grid>
          </Grid>
          <Stack direction="row" spacing={1} mt={3}>
            <Button variant="contained" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Service'}</Button>
            <Button variant="outlined" onClick={() => setDrawerOpen(false)}>Cancel</Button>
          </Stack>
        </Box>
      </Drawer>

      <Dialog open={Boolean(deleteId)} onClose={() => setDeleteId(null)}>
        <DialogTitle>Delete Service</DialogTitle>
        <DialogContent>Are you sure you want to delete this service?</DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteId(null)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={() => void onDelete()}>Delete</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
