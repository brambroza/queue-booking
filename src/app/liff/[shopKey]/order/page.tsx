import { LiffBookingClient } from '@/components/line/liff-booking-client';

/** Rich menu "สั่งอาหาร": the order screen for today's on-site queue, without the member page. */
export default async function LiffOrderPage({ params }: { params: Promise<{ shopKey: string }> }) {
  const { shopKey } = await params;
  return <LiffBookingClient shopKey={shopKey} initialTab="order" />;
}
