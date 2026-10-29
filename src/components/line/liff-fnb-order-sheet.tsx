'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, Chip, CircularProgress, Drawer, IconButton, Stack, TextField, Typography } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import RemoveRoundedIcon from '@mui/icons-material/RemoveRounded';
import { useToast } from '@/components/ui/toast';

type MenuItem = {
  id: string;
  category: string;
  item_name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_available: boolean;
};

type MyOrder = {
  id: string;
  status: 'new' | 'preparing' | 'served' | 'cancelled';
  total_amount: number;
  created_at: string;
  fnb_order_items: Array<{ item_name: string; unit_price: number; quantity: number }> | null;
};

type MyRequest = { id: string; request_type: 'call_staff' | 'bill'; status: 'open' | 'acknowledged'; total_amount: number | null };

type Bill = {
  booking_amount: number;
  booking_paid: boolean;
  fnb_lines: Array<{ item_name: string; quantity: number; amount: number }>;
  fnb_total: number;
  due_total: number;
};

const STATUS_LABEL: Record<MyOrder['status'], string> = { new: 'ส่งแล้ว รอร้านรับ', preparing: 'กำลังเตรียม', served: 'เสิร์ฟแล้ว', cancelled: 'ยกเลิก' };
const STATUS_COLOR: Record<MyOrder['status'], 'warning' | 'info' | 'success' | 'default'> = { new: 'warning', preparing: 'info', served: 'success', cancelled: 'default' };
const baht = (n: number) => `${n.toLocaleString('th-TH')} บาท`;

type Props = {
  open: boolean;
  onClose: () => void;
  shopKey: string;
  bookingId: string;
  /** Where the order will be served, shown to the customer ("Bay 3"). */
  placeLabel: string;
  lineUserId: string;
  /** Live LIFF ID token (the server verifies it to know who is ordering). */
  getIdToken: () => string;
  /**
   * `sheet` (default) = bottom drawer over the queue list; `page` = the whole
   * screen of the order page (rich menu "สั่งอาหาร"), no drawer and no close button.
   */
  variant?: 'sheet' | 'page';
};

/** LIFF bottom sheet: pick from the menu, send the order, follow its status. */
export function LiffFnbOrderSheet({ open, onClose, shopKey, bookingId, placeLabel, lineUserId, getIdToken, variant = 'sheet' }: Props) {
  const { push } = useToast();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [orders, setOrders] = useState<MyOrder[]>([]);
  const [requests, setRequests] = useState<MyRequest[]>([]);
  const [view, setView] = useState<'menu' | 'bill'>('menu');
  const [bill, setBill] = useState<Bill | null>(null);
  const [billLoading, setBillLoading] = useState(false);
  const [requesting, setRequesting] = useState<'' | 'call_staff' | 'bill'>('');

  const loadOrders = useCallback(async () => {
    const res = await fetch(`/api/public/shop/${shopKey}/fnb/my-orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ line_user_id: lineUserId, id_token: getIdToken() || undefined, booking_id: bookingId }),
    });
    if (res.ok) {
      const json = await res.json();
      setOrders((json.data ?? []) as MyOrder[]);
      setRequests((json.requests ?? []) as MyRequest[]);
    }
  }, [shopKey, lineUserId, getIdToken, bookingId]);

  /** Identity fields every request body carries; the server verifies the token. */
  const identity = useCallback(
    () => ({ line_user_id: lineUserId, id_token: getIdToken() || undefined, booking_id: bookingId }),
    [lineUserId, getIdToken, bookingId],
  );

  const loadBill = useCallback(async () => {
    setBillLoading(true);
    const res = await fetch(`/api/public/shop/${shopKey}/fnb/bill`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(identity()),
    });
    const json = await res.json().catch(() => ({}));
    setBillLoading(false);
    if (!res.ok) return push((json as { error?: string }).error ?? 'โหลดบิลไม่สำเร็จ', 'error');
    setBill((json as { data: Bill }).data);
  }, [shopKey, identity, push]);

  async function sendRequest(type: 'call_staff' | 'bill') {
    if (requesting) return;
    setRequesting(type);
    const res = await fetch(`/api/public/shop/${shopKey}/fnb/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...identity(), request_type: type }),
    });
    const json = await res.json().catch(() => ({}));
    setRequesting('');
    if (!res.ok) return push((json as { error?: string }).error ?? 'ส่งคำขอไม่สำเร็จ', 'error');
    push(type === 'bill' ? 'แจ้งร้านขอเช็คบิลแล้ว' : 'เรียกพนักงานแล้ว');
    await loadOrders();
  }

  function openBill() {
    setView('bill');
    void loadBill();
  }

  const loadMenu = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/public/shop/${shopKey}/fnb/menu`, { cache: 'no-store' });
    const json = await res.json().catch(() => ({}));
    setEnabled(res.ok ? json.data?.enabled !== false : false);
    setItems(res.ok ? ((json.data?.items ?? []) as MenuItem[]) : []);
    setLoading(false);
  }, [shopKey]);

  useEffect(() => {
    if (!open) setView('menu');
  }, [open]);

  useEffect(() => {
    if (!open) return;
    void loadMenu();
    void loadOrders();
    // Status moves on the staff side, so refresh while the sheet is open.
    const timer = window.setInterval(() => void loadOrders(), 20_000);
    return () => window.clearInterval(timer);
  }, [open, loadMenu, loadOrders]);

  const grouped = useMemo(() => {
    const map = new Map<string, MenuItem[]>();
    for (const item of items) map.set(item.category, [...(map.get(item.category) ?? []), item]);
    return Array.from(map.entries());
  }, [items]);

  const lines = useMemo(
    () => items.filter((i) => (cart[i.id] ?? 0) > 0).map((i) => ({ item: i, quantity: cart[i.id] })),
    [items, cart],
  );
  const total = lines.reduce((sum, l) => sum + Number(l.item.price) * l.quantity, 0);
  const count = lines.reduce((sum, l) => sum + l.quantity, 0);

  function change(id: string, delta: number) {
    setCart((prev) => {
      const next = Math.max(0, Math.min(99, (prev[id] ?? 0) + delta));
      const copy = { ...prev };
      if (next === 0) delete copy[id];
      else copy[id] = next;
      return copy;
    });
  }

  async function send() {
    if (lines.length === 0 || sending) return;
    setSending(true);
    const res = await fetch(`/api/public/shop/${shopKey}/fnb/order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        line_user_id: lineUserId,
        id_token: getIdToken() || undefined,
        booking_id: bookingId,
        note: note || undefined,
        items: lines.map((l) => ({ menu_item_id: l.item.id, quantity: l.quantity })),
      }),
    });
    const json = await res.json().catch(() => ({}));
    setSending(false);
    if (!res.ok) {
      if (res.status === 409) void loadMenu();
      return push((json as { error?: string }).error ?? 'ส่งออเดอร์ไม่สำเร็จ', 'error');
    }
    push('ส่งออเดอร์ให้ร้านแล้ว');
    setCart({});
    setNote('');
    await loadOrders();
  }

  const isPage = variant === 'page';
  const body = (
    <>
      <Box sx={isPage ? { pb: 10 } : { p: 2, pb: 12, overflowY: 'auto' }}>
        {isPage ? (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>เสิร์ฟที่ {placeLabel}</Typography>
        ) : (
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
            <Box>
              <Typography variant="h6" fontWeight={800}>สั่งอาหาร / เครื่องดื่ม</Typography>
              <Typography variant="caption" color="text.secondary">เสิร์ฟที่ {placeLabel}</Typography>
            </Box>
            <IconButton aria-label="ปิด" onClick={onClose}><CloseRoundedIcon /></IconButton>
          </Stack>
        )}

        {(() => {
          const callReq = requests.find((r) => r.request_type === 'call_staff');
          const billReq = requests.find((r) => r.request_type === 'bill');
          return (
            <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
              <Button
                fullWidth
                variant="outlined"
                color="error"
                disabled={Boolean(callReq) || requesting === 'call_staff'}
                onClick={() => void sendRequest('call_staff')}
                sx={{ minHeight: 44 }}
              >
                {callReq ? (callReq.status === 'acknowledged' ? 'พนักงานรับทราบแล้ว' : 'เรียกแล้ว รอพนักงาน') : 'เรียกพนักงาน'}
              </Button>
              <Button fullWidth variant={view === 'bill' ? 'contained' : 'outlined'} onClick={() => (view === 'bill' ? setView('menu') : openBill())} sx={{ minHeight: 44 }}>
                {billReq ? (billReq.status === 'acknowledged' ? 'ร้านรับเรื่องเช็คบิลแล้ว' : 'ขอเช็คบิลแล้ว') : view === 'bill' ? 'กลับไปสั่งอาหาร' : 'เช็คบิล'}
              </Button>
            </Stack>
          );
        })()}

        {view === 'bill' ? (
          <Stack spacing={1.5}>
            {billLoading && !bill ? (
              <Stack alignItems="center" sx={{ py: 4 }}><CircularProgress size={28} /></Stack>
            ) : bill ? (
              <>
                <Box sx={{ border: 1, borderColor: 'divider', borderRadius: '12px', p: 1.5 }}>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography>ค่าบริการ {placeLabel}</Typography>
                    <Typography>{bill.booking_paid ? 'ชำระแล้ว' : baht(bill.booking_amount)}</Typography>
                  </Stack>
                  {bill.fnb_lines.map((l) => (
                    <Stack key={`${l.item_name}-${l.amount}`} direction="row" justifyContent="space-between">
                      <Typography color="text.secondary">{l.quantity}× {l.item_name}</Typography>
                      <Typography color="text.secondary">{baht(l.amount)}</Typography>
                    </Stack>
                  ))}
                  {bill.fnb_lines.length === 0 ? <Typography variant="body2" color="text.secondary">ยังไม่มีรายการอาหาร</Typography> : null}
                  <Stack direction="row" justifyContent="space-between" sx={{ mt: 1, pt: 1, borderTop: 1, borderColor: 'divider' }}>
                    <Typography fontWeight={800}>ยอดที่ต้องชำระ</Typography>
                    <Typography fontWeight={800}>{baht(bill.due_total)}</Typography>
                  </Stack>
                </Box>
                <Alert severity="info">ยอดนี้เป็นยอดโดยประมาณ พนักงานจะยืนยันยอดจริงที่บูท (เช่น กรณีใช้เวลาเกิน)</Alert>
                {requests.some((r) => r.request_type === 'bill') ? (
                  <Alert severity="success">แจ้งร้านแล้ว พนักงานจะนำบิลมาให้ที่ {placeLabel}</Alert>
                ) : (
                  <Button fullWidth variant="contained" size="large" disabled={requesting === 'bill'} onClick={() => void sendRequest('bill')} sx={{ minHeight: 48 }}>
                    {requesting === 'bill' ? 'กำลังส่ง…' : 'ขอเช็คบิล'}
                  </Button>
                )}
              </>
            ) : null}
          </Stack>
        ) : null}

        {view === 'menu' && orders.length > 0 ? (
          <Stack spacing={1} sx={{ mb: 2 }}>
            {orders.map((o) => (
              <Box key={o.id} sx={{ border: 1, borderColor: 'divider', borderRadius: '12px', p: 1.25 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" fontWeight={700}>
                    ออเดอร์ {new Date(o.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                  </Typography>
                  <Chip size="small" color={STATUS_COLOR[o.status]} label={STATUS_LABEL[o.status]} />
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  {(o.fnb_order_items ?? []).map((i) => `${i.quantity}× ${i.item_name}`).join(', ')} · {baht(Number(o.total_amount))}
                </Typography>
              </Box>
            ))}
          </Stack>
        ) : null}

        {view === 'bill' ? null : loading ? (
          <Stack alignItems="center" sx={{ py: 4 }}><CircularProgress size={28} /></Stack>
        ) : !enabled || items.length === 0 ? (
          <Alert severity="info">ตอนนี้ยังไม่เปิดให้สั่งอาหารผ่าน LINE กรุณาติดต่อพนักงาน</Alert>
        ) : (
          <Stack spacing={2}>
            {grouped.map(([category, list]) => (
              <Box key={category}>
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>{category}</Typography>
                <Stack spacing={1}>
                  {list.map((item) => {
                    const qty = cart[item.id] ?? 0;
                    return (
                      <Stack key={item.id} direction="row" spacing={1.25} alignItems="center" sx={{ opacity: item.is_available ? 1 : 0.5 }}>
                        {item.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.image_url} alt="" loading="lazy" style={{ width: 56, height: 56, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
                        ) : null}
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography fontWeight={600}>{item.item_name}</Typography>
                          {item.description ? <Typography variant="caption" color="text.secondary" display="block" noWrap>{item.description}</Typography> : null}
                          <Typography variant="body2" fontWeight={700}>{baht(Number(item.price))}</Typography>
                        </Box>
                        {item.is_available ? (
                          <Stack direction="row" alignItems="center" spacing={0.5}>
                            {qty > 0 ? (
                              <>
                                <IconButton size="small" aria-label="ลด" onClick={() => change(item.id, -1)}><RemoveRoundedIcon fontSize="small" /></IconButton>
                                <Typography sx={{ minWidth: 20, textAlign: 'center' }} fontWeight={700}>{qty}</Typography>
                              </>
                            ) : null}
                            <IconButton size="small" color="primary" aria-label="เพิ่ม" onClick={() => change(item.id, 1)}><AddRoundedIcon fontSize="small" /></IconButton>
                          </Stack>
                        ) : (
                          <Chip size="small" label="หมด" />
                        )}
                      </Stack>
                    );
                  })}
                </Stack>
              </Box>
            ))}
            <TextField label="หมายเหตุถึงร้าน (ไม่บังคับ)" size="small" value={note} onChange={(e) => setNote(e.target.value)} inputProps={{ maxLength: 300 }} />
          </Stack>
        )}
      </Box>

      {view === 'menu' && lines.length > 0 ? (
        <Box
          sx={{
            position: isPage ? 'fixed' : 'sticky',
            left: 0,
            right: 0,
            bottom: 0,
            p: 2,
            pb: isPage ? 'calc(16px + env(safe-area-inset-bottom, 0px))' : 2,
            bgcolor: 'background.paper',
            borderTop: 1,
            borderColor: 'divider',
            zIndex: 2,
          }}
        >
          <Button fullWidth variant="contained" size="large" disabled={sending} onClick={() => void send()} sx={{ minHeight: 48 }}>
            {sending ? 'กำลังส่ง…' : `ส่งออเดอร์ ${count} รายการ · ${baht(total)}`}
          </Button>
        </Box>
      ) : null}
    </>
  );

  if (isPage) return <Box>{body}</Box>;
  return (
    <Drawer anchor="bottom" open={open} onClose={onClose} PaperProps={{ sx: { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '92vh' } }}>
      {body}
    </Drawer>
  );
}
