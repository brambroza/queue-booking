import type { ShowcaseStatus } from '@/lib/showcase/showcase-rules';

const STYLES: Record<ShowcaseStatus | 'none', { label: string; className: string }> = {
  none: { label: 'ยังไม่ยินยอม', className: 'bg-slate-100 text-slate-600' },
  draft: { label: 'ยังไม่ส่งตรวจ', className: 'bg-slate-100 text-slate-600' },
  pending: { label: 'รอตรวจ', className: 'bg-amber-100 text-amber-800' },
  approved: { label: 'แสดงอยู่บนเว็บ', className: 'bg-emerald-100 text-emerald-800' },
  rejected: { label: 'ไม่อนุมัติ', className: 'bg-rose-100 text-rose-700' },
  revoked: { label: 'ถอนความยินยอมแล้ว', className: 'bg-slate-100 text-slate-600' },
};

/** Review state of a shop's showcase entry; a pending re-review of a live shop still reads as live. */
export function ShowcaseStatusPill({ status, published }: { status: ShowcaseStatus | 'none'; published?: boolean }) {
  const style = STYLES[status];
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${style.className}`}>{style.label}</span>
      {published && status === 'pending' && <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STYLES.approved.className}`}>แสดงอยู่บนเว็บ</span>}
    </span>
  );
}
