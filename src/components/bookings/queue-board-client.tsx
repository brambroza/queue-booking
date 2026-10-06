'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import HourglassBottomRoundedIcon from '@mui/icons-material/HourglassBottomRounded';
import CampaignRoundedIcon from '@mui/icons-material/CampaignRounded';
import NotificationsActiveRoundedIcon from '@mui/icons-material/NotificationsActiveRounded';
import PlayCircleRoundedIcon from '@mui/icons-material/PlayCircleRounded';
import DoneAllRoundedIcon from '@mui/icons-material/DoneAllRounded';
import TaskAltRoundedIcon from '@mui/icons-material/TaskAltRounded';
import { useToast } from '@/components/ui/toast';
import { customerLabel } from '@/lib/booking/customer-label';
import { ActionIconGroup } from '@/components/ui/action-icon-group';
import { useBranchScope } from '@/components/layout/branch-scope-provider';
import { getTodayISOInBangkok } from '@/lib/utils/date-format';
import type { BookingStatus } from '@/types/db';

type Booking = {
  id: string;
  queue_number: string;
  booking_date: string;
  start_time: string;
  status: BookingStatus;
  resource_name?: string | null;
  line_user_id?: string | null;
  checked_in_at?: string | null;
  call_count?: number | null;
  customers: { full_name?: string | null; nickname?: string | null } | null;
  services: { service_name?: string } | null;
};

/**
 * Kanban columns. `checked_in` (customer tapped "ฉันมาถึงแล้ว") sits with
 * `waiting` because both mean "on site, not yet called".
 */
const COLUMNS: Array<{ key: string; label: string; statuses: BookingStatus[] }> = [
  { key: 'pending', label: 'รออนุมัติ', statuses: ['pending', 'pending_approval'] },
  { key: 'confirmed', label: 'ยืนยันแล้ว', statuses: ['confirmed'] },
  { key: 'waiting', label: 'รอเรียก', statuses: ['waiting', 'checked_in'] },
  { key: 'called', label: 'กำลังเรียก', statuses: ['called'] },
  { key: 'serving', label: 'กำลังให้บริการ', statuses: ['serving'] },
  { key: 'completed', label: 'เสร็จสิ้น', statuses: ['completed'] },
];

/** Rows per request (API cap) and max requests per load (1,000 queues, same ceiling as reports). */
const PAGE_SIZE = 100;
const MAX_PAGES = 10;

/** Space kept below the board so it does not touch the window edge. */
const BOARD_BOTTOM_GAP = 16;
/** Never squash the board below this; short windows scroll the page instead. */
const BOARD_MIN_HEIGHT = 360;
/** Tailwind `md`: below it the columns stack and the page scrolls normally. */
const BOARD_FIXED_MIN_WIDTH = 768;

type ListResponse = { data?: Booking[]; pagination?: { total?: number }; error?: string };
/**
 * Soft tint per column: dot (header + summary chip), badge, card background and a 4px left accent.
 * Hues follow the status meaning (amber = needs staff, sky = booked, violet = on site,
 * orange = being called, emerald = in service, slate = done). Full class strings on purpose
 * so Tailwind can see them.
 */
const TONES: Record<string, { dot: string; badge: string; card: string; accent: string }> = {
  pending: {
    dot: 'bg-amber-400',
    badge: 'bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300',
    card: 'bg-amber-50/70 dark:bg-amber-400/[0.07]',
    accent: 'border-l-amber-400',
  },
  confirmed: {
    dot: 'bg-sky-400',
    badge: 'bg-sky-100 text-sky-800 dark:bg-sky-400/15 dark:text-sky-300',
    card: 'bg-sky-50/70 dark:bg-sky-400/[0.07]',
    accent: 'border-l-sky-400',
  },
  waiting: {
    dot: 'bg-violet-400',
    badge: 'bg-violet-100 text-violet-800 dark:bg-violet-400/15 dark:text-violet-300',
    card: 'bg-violet-50/70 dark:bg-violet-400/[0.07]',
    accent: 'border-l-violet-400',
  },
  called: {
    dot: 'bg-orange-400',
    badge: 'bg-orange-100 text-orange-800 dark:bg-orange-400/15 dark:text-orange-300',
    card: 'bg-orange-50/70 dark:bg-orange-400/[0.07]',
    accent: 'border-l-orange-400',
  },
  serving: {
    dot: 'bg-emerald-400',
    badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-300',
    card: 'bg-emerald-50/70 dark:bg-emerald-400/[0.07]',
    accent: 'border-l-emerald-400',
  },
  completed: {
    dot: 'bg-slate-300 dark:bg-slate-500',
    badge: 'bg-slate-100 text-slate-600 dark:bg-slate-400/15 dark:text-slate-300',
    card: 'bg-slate-50/80 dark:bg-slate-400/[0.06]',
    accent: 'border-l-slate-300 dark:border-l-slate-500',
  },
};

type PatchResponse = { error?: string; data?: { line_notified?: boolean } };

export function QueueBoardClient() {
  const { push } = useToast();
  const { withBranch, branchId } = useBranchScope();
  const [rows, setRows] = useState<Booking[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Bangkok calendar day, not UTC: before 07:00 ICT the UTC date is still yesterday.
  const [date, setDate] = useState(getTodayISOInBangkok());

  /** Load every queue of the day (the API pages at 100), so a busy day is never cut off. */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all: Booking[] = [];
      let count = 0;
      for (let page = 1; page <= MAX_PAGES; page += 1) {
        const params = withBranch(new URLSearchParams({ date, page: String(page), page_size: String(PAGE_SIZE) }));
        const res = await fetch(`/api/bookings?${params.toString()}`, { cache: 'no-store' });
        const json = (await res.json().catch(() => ({}))) as ListResponse;
        if (!res.ok) throw new Error(json.error ?? 'โหลดคิวไม่สำเร็จ');
        const batch = json.data ?? [];
        all.push(...batch);
        count = json.pagination?.total ?? all.length;
        if (all.length >= count || batch.length === 0) break;
      }
      setRows(all);
      setTotal(count);
      setError(null);
      if (all.length < count) push(`แสดง ${all.length} จาก ${count} คิว — กรุณาเลือกสาขาหรือวันที่ให้แคบลง`, 'warning');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'โหลดคิวไม่สำเร็จ';
      setError(message);
      push(message, 'error');
    } finally {
      setLoading(false);
    }
  }, [date, withBranch, push]);

  // `withBranch` changes with the topbar branch selection, so this also reloads on branch switch.
  useEffect(() => { void load(); }, [load, branchId]);

  /** Cancelled / no-show queues have no column; count them so nothing is dropped silently. */
  const hiddenCount = useMemo(() => rows.filter((r) => r.status === 'cancelled' || r.status === 'no_show').length, [rows]);

  const groups = useMemo(
    () => COLUMNS.map((col) => ({ col, items: rows.filter((r) => col.statuses.includes(r.status)) })),
    [rows]
  );

  // Fit the board to the window: height = viewport - board top - gap, so only the columns
  // scroll (vertically) and the page itself does not. Skipped on phones where columns stack.
  const boardRef = useRef<HTMLDivElement>(null);
  const [boardHeight, setBoardHeight] = useState<number | null>(null);
  const fitBoard = useCallback(() => {
    const el = boardRef.current;
    if (!el || window.innerWidth < BOARD_FIXED_MIN_WIDTH) return setBoardHeight(null);
    const top = el.getBoundingClientRect().top + window.scrollY;
    setBoardHeight(Math.max(BOARD_MIN_HEIGHT, window.innerHeight - top - BOARD_BOTTOM_GAP));
  }, []);
  // Re-measure when content above the board changes height (error banner, hidden-count text).
  useLayoutEffect(() => { fitBoard(); }, [fitBoard, error, hiddenCount, loading]);
  useEffect(() => {
    window.addEventListener('resize', fitBoard);
    return () => window.removeEventListener('resize', fitBoard);
  }, [fitBoard]);

  async function setStatus(b: Booking, status: BookingStatus) {
    let res: Response;
    try {
      res = await fetch('/api/bookings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: b.id, status }),
      });
    } catch {
      return push('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง', 'error');
    }
    const json = (await res.json().catch(() => ({}))) as PatchResponse;
    if (!res.ok) return push(json.error ?? 'เปลี่ยนสถานะไม่สำเร็จ', 'error');
    if (status === 'called') {
      if (json.data?.line_notified) push('เรียกคิวแล้ว และแจ้งลูกค้าทาง LINE');
      else if (b.line_user_id) push('เรียกคิวแล้ว แต่ส่ง LINE ไม่สำเร็จ — กรุณาเรียกลูกค้าเอง', 'warning');
      else push('เรียกคิวแล้ว (คิวไม่ได้ผูก LINE กรุณาเรียกลูกค้าเอง)', 'info');
    } else {
      push('อัปเดตสถานะแล้ว');
    }
    await load();
  }

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <label className="text-sm">วันที่<input className="input mt-1 max-w-[220px]" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
          <p className="text-sm text-slate-600">
            {loading ? 'กำลังโหลด…' : `ทั้งหมด ${total} คิว`}
            {!loading && hiddenCount > 0 ? <span className="text-slate-400"> · ยกเลิก/ไม่มา {hiddenCount} คิว (ไม่แสดงบนบอร์ด)</span> : null}
          </p>
        </div>
        {/* Per-status counts, same grouping as the columns below. */}
        <ul className="mt-3 flex flex-wrap gap-2" aria-label="จำนวนคิวแต่ละสถานะ">
          {groups.map(({ col, items }) => (
            <li key={col.key} className="flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-xs">
              <span className={`h-2 w-2 rounded-full ${TONES[col.key].dot}`} aria-hidden />
              <span className="text-slate-600">{col.label}</span>
              <span className="font-semibold tabular-nums text-slate-800">{items.length}</span>
            </li>
          ))}
        </ul>
      </div>
      {error ? (
        <div role="alert" className="card flex items-center justify-between gap-3 p-3 text-sm text-red-700">
          <span>{error}</span>
          <button type="button" className="underline" onClick={() => void load()}>ลองใหม่</button>
        </div>
      ) : null}
      {/* md+: fixed to the window (2 rows x 3 cols, 1 row x 6 cols from xl); each column scrolls on its own. */}
      <div
        ref={boardRef}
        className="grid gap-3 md:grid-cols-3 md:grid-rows-2 xl:grid-cols-6 xl:grid-rows-1"
        style={boardHeight ? { height: boardHeight } : undefined}
      >
        {groups.map(({ col, items }) => {
          return (
            <section key={col.key} className="card flex max-h-[70vh] min-h-0 flex-col p-3 md:max-h-none">
              <h3 className="mb-2 flex shrink-0 items-center justify-between text-sm font-semibold">
                <span className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${TONES[col.key].dot}`} aria-hidden />
                  {col.label}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-xs tabular-nums ${TONES[col.key].badge}`}>{items.length}</span>
              </h3>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                {items.map((r) => (
                  <article
                    key={r.id}
                    className={`rounded-xl border border-l-4 border-slate-200/70 p-2.5 text-sm shadow-sm transition-shadow hover:shadow-md dark:border-slate-700/60 ${TONES[col.key].accent} ${TONES[col.key].card}`}
                  >
                    <p className="font-semibold">{r.queue_number}</p>
                    <p>{String(r.start_time).slice(0, 5)} - {customerLabel(r.customers)}</p>
                    <p className="text-xs text-slate-600">{r.services?.service_name ?? '-'}</p>
                    {r.resource_name ? <p className="text-xs text-slate-500">👤 {r.resource_name}</p> : null}
                    {r.status === 'checked_in' ? <p className="text-xs text-violet-600">ลูกค้ามาถึงแล้ว</p> : null}
                    {r.status === 'called' && Number(r.call_count ?? 0) > 1 ? <p className="text-xs text-amber-600">เรียกแล้ว {r.call_count} ครั้ง</p> : null}
                    <div className="mt-2 flex justify-end">
                      <ActionIconGroup
                        actions={[
                          {
                            key: 'confirm',
                            hidden: col.key !== 'pending',
                            icon: <TaskAltRoundedIcon fontSize="small" />,
                            fallbackLabel: r.status === 'pending_approval' ? 'อนุมัติ' : 'ยืนยัน',
                            color: 'success',
                            onClick: () => void setStatus(r, 'confirmed'),
                          },
                          {
                            key: 'waiting',
                            hidden: col.key !== 'confirmed',
                            icon: <HourglassBottomRoundedIcon fontSize="small" />,
                            labelKey: 'status.waiting',
                            fallbackLabel: 'รอเรียก',
                            color: 'warning',
                            onClick: () => void setStatus(r, 'waiting'),
                          },
                          {
                            key: 'call',
                            hidden: !(col.key === 'confirmed' || col.key === 'waiting'),
                            icon: <CampaignRoundedIcon fontSize="small" />,
                            labelKey: 'status.called',
                            fallbackLabel: 'เรียกคิว',
                            color: 'info',
                            onClick: () => void setStatus(r, 'called'),
                          },
                          {
                            key: 'recall',
                            hidden: col.key !== 'called',
                            icon: <NotificationsActiveRoundedIcon fontSize="small" />,
                            fallbackLabel: 'เรียกซ้ำ',
                            color: 'warning',
                            onClick: () => void setStatus(r, 'called'),
                          },
                          {
                            key: 'serving',
                            hidden: !(col.key === 'waiting' || col.key === 'called'),
                            icon: <PlayCircleRoundedIcon fontSize="small" />,
                            labelKey: 'status.serving',
                            fallbackLabel: 'เริ่มบริการ',
                            color: 'info',
                            onClick: () => void setStatus(r, 'serving'),
                          },
                          {
                            key: 'completed',
                            hidden: col.key !== 'serving',
                            icon: <DoneAllRoundedIcon fontSize="small" />,
                            labelKey: 'bookings.complete',
                            fallbackLabel: 'เสร็จสิ้น',
                            color: 'success',
                            onClick: () => void setStatus(r, 'completed'),
                          },
                        ]}
                      />
                    </div>
                  </article>
                ))}
                {items.length === 0 ? <p className="text-xs text-slate-400">{loading ? '…' : 'ไม่มีคิว'}</p> : null}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
