'use client';

import { useCallback, useEffect, useState } from 'react';
import { Alert, Box, Button, Card, CardContent, Chip, Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { useToast } from '@/components/ui/toast';
import { EmptyState } from '@/components/ui/empty-state';

type OrderStatus = 'new' | 'preparing' | 'served' | 'cancelled';

type Order = {
  id: string;
  status: OrderStatus;
  total_amount: number;
  note: string | null;
  created_at: string;
  fnb_order_items: Array<{ id: string; item_name: string; unit_price: number; quantity: number; note: string | null }> | null;
  bookings: { queue_number: string | null; resource_name: string | null; customers: { full_name?: string | null; nickname?: string | null } | { full_name?: string | null; nickname?: string | null }[] | null } | null;
  booking_resources: { resource_name: string | null; resource_code: string | null } | null;
};

type ServiceRequest = {
  id: string;
  request_type: 'call_staff' | 'bill';
  status: 'open' | 'acknowledged';
  booking_amount: number | null;
  fnb_amount: number | null;
  total_amount: number | null;
  created_at: string;
  bookings: Order['bookings'];
  booking_resources: Order['booking_resources'];
};

const STATUS_LABEL: Record<OrderStatus, string> = { new: 'ใหม่', preparing: 'กำลังทำ', served: 'เสิร์ฟแล้ว', cancelled: 'ยกเลิก' };
const STATUS_COLOR: Record<OrderStatus, 'warning' | 'info' | 'success' | 'default'> = { new: 'warning', preparing: 'info', served: 'success', cancelled: 'default' };
/** The board refreshes itself so a new order shows up without staff reloading. */
const POLL_MS = 10_000;

function customerLabel(o: Pick<Order, 'bookings'>): string {
  const c = Array.isArray(o.bookings?.customers) ? o.bookings?.customers[0] : o.bookings?.customers;
  return c?.nickname || c?.full_name || '';
}

function whereLabel(o: Pick<Order, 'bookings' | 'booking_resources'>): string {
  return o.booking_resources?.resource_name || o.bookings?.resource_name || o.bookings?.queue_number || '—';
}

/** Portal: live order board for staff (new → preparing → served). */
export function FnbOrdersBoard() {
  const { push } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [filter, setFilter] = useState<'open' | 'all'>('open');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [fnbOff, setFnbOff] = useState(false);

  const load = useCallback(async () => {
    const [res, resReq] = await Promise.all([
      fetch(`/api/fnb-orders?status=${filter === 'all' ? 'all' : 'open'}`, { cache: 'no-store' }),
      fetch('/api/fnb-requests', { cache: 'no-store' }),
    ]);
    const json = await res.json();
    if (res.ok) setOrders((json.data ?? []) as Order[]);
    // Requests are secondary: a failure here must not hide the orders.
    if (resReq.ok) setRequests(((await resReq.json()).data ?? []) as ServiceRequest[]);
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(() => {
    void fetch('/api/fnb-settings', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => setFnbOff(j?.data ? j.data.enabled === false : false))
      .catch(() => undefined);
  }, []);

  async function move(order: Order, status: OrderStatus) {
    setBusyId(order.id);
    const res = await fetch('/api/fnb-orders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: order.id, status }),
    });
    const json = await res.json();
    setBusyId(null);
    if (!res.ok) {
      push(json.error ?? 'อัปเดตสถานะไม่สำเร็จ', 'error');
      return void load();
    }
    if (json.data?.notified === false && status !== 'cancelled') push('อัปเดตแล้ว (ส่ง LINE ถึงลูกค้าไม่ได้)', 'info');
    await load();
  }

  async function moveRequest(request: ServiceRequest, status: 'acknowledged' | 'closed') {
    setBusyId(request.id);
    const res = await fetch('/api/fnb-requests', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: request.id, status }),
    });
    const json = await res.json();
    setBusyId(null);
    if (!res.ok) {
      push(json.error ?? 'อัปเดตคำขอไม่สำเร็จ', 'error');
      return void load();
    }
    if (status === 'acknowledged' && json.data?.notified === false) push('รับทราบแล้ว (ส่ง LINE ถึงลูกค้าไม่ได้)', 'info');
    await load();
  }

  return (
    <Stack spacing={2}>
      {requests.map((r) => (
        <Card key={r.id} sx={{ borderLeft: 4, borderLeftColor: r.status === 'open' ? 'error.main' : 'info.main' }}>
          <CardContent>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
              <Box>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                  <Typography variant="h6" fontWeight={700}>{whereLabel(r)}</Typography>
                  <Chip size="small" color={r.request_type === 'bill' ? 'secondary' : 'error'} label={r.request_type === 'bill' ? 'ขอเช็คบิล' : 'เรียกพนักงาน'} />
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  {[customerLabel(r), new Date(r.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })].filter(Boolean).join(' · ')}
                </Typography>
              </Box>
              <Chip size="small" color={r.status === 'open' ? 'warning' : 'info'} label={r.status === 'open' ? 'รอรับทราบ' : 'รับทราบแล้ว'} />
            </Stack>
            {r.request_type === 'bill' && r.total_amount !== null ? (
              <Typography sx={{ mt: 1.5 }}>
                ค่าบูทที่ยังไม่จ่าย {Number(r.booking_amount ?? 0).toLocaleString('th-TH')} + อาหาร {Number(r.fnb_amount ?? 0).toLocaleString('th-TH')} ={' '}
                <b>{Number(r.total_amount).toLocaleString('th-TH')} บาท</b>
                <Typography component="span" variant="caption" color="text.secondary" display="block">ยอดโดยประมาณ ณ ตอนที่ลูกค้ากด กรุณายืนยันยอดจริงที่บูท (ยังไม่รวมเวลาที่ใช้เกิน)</Typography>
              </Typography>
            ) : null}
            <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
              {r.status === 'open' ? (
                <Button variant="contained" disabled={busyId === r.id} onClick={() => void moveRequest(r, 'acknowledged')} sx={{ minHeight: 44 }}>รับทราบ</Button>
              ) : null}
              <Button variant={r.status === 'open' ? 'text' : 'contained'} color="success" disabled={busyId === r.id} onClick={() => void moveRequest(r, 'closed')} sx={{ minHeight: 44 }}>เสร็จแล้ว</Button>
            </Stack>
          </CardContent>
        </Card>
      ))}
      {fnbOff ? <Alert severity="warning">ตอนนี้ปิดการสั่งอาหารผ่าน LINE อยู่ — ออเดอร์เก่ายังจัดการได้ตามปกติ เปิดได้ที่หน้า “เมนูอาหาร”</Alert> : null}
      <ToggleButtonGroup size="small" exclusive value={filter} onChange={(_, v: 'open' | 'all' | null) => v && setFilter(v)}>
        <ToggleButton value="open">ที่ต้องทำ</ToggleButton>
        <ToggleButton value="all">ย้อนหลัง 24 ชม.</ToggleButton>
      </ToggleButtonGroup>

      {loading ? (
        <Typography color="text.secondary">กำลังโหลด…</Typography>
      ) : orders.length === 0 ? (
        <EmptyState title="ยังไม่มีออเดอร์" description="ออเดอร์จากลูกค้าจะขึ้นที่นี่อัตโนมัติ" />
      ) : (
        orders.map((o) => (
          <Card key={o.id}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
                <Box>
                  <Typography variant="h6" fontWeight={700}>{whereLabel(o)}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {[customerLabel(o), new Date(o.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })].filter(Boolean).join(' · ')}
                  </Typography>
                </Box>
                <Chip size="small" color={STATUS_COLOR[o.status]} label={STATUS_LABEL[o.status]} />
              </Stack>

              <Stack sx={{ mt: 1.5 }} spacing={0.5}>
                {(o.fnb_order_items ?? []).map((i) => (
                  <Stack key={i.id} direction="row" justifyContent="space-between">
                    <Typography>{i.quantity} × {i.item_name}{i.note ? ` (${i.note})` : ''}</Typography>
                    <Typography color="text.secondary">{(i.unit_price * i.quantity).toLocaleString('th-TH')}</Typography>
                  </Stack>
                ))}
              </Stack>
              {o.note ? <Alert severity="info" sx={{ mt: 1.5 }}>{o.note}</Alert> : null}
              <Typography fontWeight={700} sx={{ mt: 1.5 }}>รวม {Number(o.total_amount).toLocaleString('th-TH')} บาท</Typography>

              {o.status === 'new' || o.status === 'preparing' ? (
                <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                  {o.status === 'new' ? (
                    <Button variant="contained" disabled={busyId === o.id} onClick={() => void move(o, 'preparing')} sx={{ minHeight: 44 }}>รับออเดอร์</Button>
                  ) : null}
                  <Button variant="contained" color="success" disabled={busyId === o.id} onClick={() => void move(o, 'served')} sx={{ minHeight: 44 }}>เสิร์ฟแล้ว</Button>
                  <Button color="error" disabled={busyId === o.id} onClick={() => void move(o, 'cancelled')} sx={{ minHeight: 44 }}>ยกเลิก</Button>
                </Stack>
              ) : null}
            </CardContent>
          </Card>
        ))
      )}
    </Stack>
  );
}
