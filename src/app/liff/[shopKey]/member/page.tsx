import { redirect } from 'next/navigation';
import { LiffBookingClient } from '@/components/line/liff-booking-client';

export default async function LiffMemberPage({
  params,
  searchParams,
}: {
  params: Promise<{ shopKey: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { shopKey } = await params;
  const qs = await searchParams;
  // A member LIFF whose endpoint is this page gets the rich menu "สั่งอาหาร"
  // tap as `?tab=order`. Skip while `liff.state` is present — the LIFF SDK
  // consumes it first, then reloads with the plain query.
  const tab = Array.isArray(qs.tab) ? qs.tab[0] : qs.tab;
  if (!qs['liff.state'] && tab?.toLowerCase() === 'order') {
    redirect(`/liff/${encodeURIComponent(shopKey)}/order`);
  }
  return <LiffBookingClient shopKey={shopKey} initialTab="account" />;
}
