import { redirect } from 'next/navigation';
import { LiffBookingClient } from '@/components/line/liff-booking-client';

/** True when the query (or LIFF's `liff.state` wrapper of it) asks for the "my queues" tab. */
function wantsAccountTab(qs: Record<string, string | string[] | undefined>): boolean {
  const pick = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';
  const tab = (pick(qs.tab) || pick(qs.view)).toLowerCase();
  return tab === 'account' || tab === 'member';
}

export default async function LiffBookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ shopKey: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { shopKey } = await params;
  const qs = await searchParams;
  // Payment Flex buttons (upload slip) link to `?tab=account`; this page used to
  // ignore it and open the booking form. Skip while `liff.state` is present —
  // the LIFF SDK must consume it first, then reloads with the plain query.
  if (!qs['liff.state'] && wantsAccountTab(qs)) {
    // Keep `booking_id` so the account tab can open that queue's payment panel.
    const bookingId = Array.isArray(qs.booking_id) ? qs.booking_id[0] : qs.booking_id;
    const query = bookingId ? `?booking_id=${encodeURIComponent(bookingId)}` : '';
    redirect(`/liff/${encodeURIComponent(shopKey)}/member${query}`);
  }
  return <LiffBookingClient shopKey={shopKey} initialTab="booking" />;
}
