import type { PromoCard } from '@/components/demo/demo-flex-carousel';

export type DemoMenuAction = 'booking' | 'member' | 'check' | 'promo' | 'contact' | 'open_liff';

export type DemoBooking = {
  queueNo: string;
  branchName: string;
  serviceName: string;
  resourceName?: string;
  dateLabel: string;
  timeLabel: string;
  customerName: string;
  customerPhone?: string;
};

export type DemoQueueStatus = 'waiting' | 'called' | 'serving' | 'completed';

export type DemoQueueItem = DemoBooking & {
  id: string;
  status: DemoQueueStatus;
  resourceName?: string;
};

export type DemoMemberProfile = {
  name: string;
  phone: string;
  tier: string;
  points: number;
  totalBookings: number;
  lastQueueNo?: string;
};

export type DemoTemplate = 'barber' | 'restaurant' | 'clinic' | 'meeting';

export type ChatMessage = {
  id: string;
  role: 'customer' | 'bot' | 'system';
  text?: string;
  type?: 'text' | 'flex_booking_success' | 'member_profile' | 'promo';
  booking?: DemoBooking;
  promos?: PromoCard[];
};
