import type { BlogPost } from '@/components/public/blog-content';

export const blogPostsEn: BlogPost[] = [
  {
    slug: 'line-oa-queue-booking-for-business',
    title: 'What Is LINE OA Queue Booking and Which Businesses Benefit Most?',
    description: 'A practical overview of LINE OA queue booking, LIFF flows, and dashboard operations for service businesses.',
    category: 'Queue Booking Basics',
    publishedAt: '2026-05-10',
    readingMinutes: 6,
    keywords: ['line oa queue booking', 'liff booking', 'queue management'],
    sections: [
      {
        heading: 'Why Service Businesses Need Queue Booking',
        body: [
          'Manual queue handling via chat or notebooks causes duplicate bookings, slow responses, and low visibility.',
          'A LINE-integrated queue system lets customers book instantly while staff manages all queues in one dashboard.',
        ],
      },
      {
        heading: 'Core Components',
        body: [
          'Customer side: ask available slots on LINE and book via LIFF.',
          'Business side: manage branches, services, working hours, and queue statuses.',
        ],
      },
      {
        heading: 'Best-fit Industries',
        body: [
          'Barbers, clinics, restaurants, service centers, and appointment-heavy teams.',
          'Supports both fixed slot and flexible duration queue models.',
        ],
      },
    ],
  },
  {
    slug: 'reduce-no-show-with-line-reminder',
    title: 'How to Reduce No-show with LINE Confirmations and Reminders',
    description: 'Design a queue confirmation and reminder flow in LINE to reduce no-show and improve slot utilization.',
    category: 'Queue Operations',
    publishedAt: '2026-05-10',
    readingMinutes: 5,
    keywords: ['reduce no-show', 'line reminder', 'appointment confirmation'],
    sections: [
      {
        heading: 'Common No-show Causes',
        body: [
          'Customers forget, plans change, or they miss confirmation messages.',
          'Without reminders, valuable service slots are lost.',
        ],
      },
      {
        heading: 'Recommended Flow',
        body: [
          'Send instant booking confirmation with queue number and appointment details.',
          'Send follow-up reminders (e.g., 1 day and 1 hour before service).',
        ],
      },
      {
        heading: 'KPIs to Track',
        body: [
          'No-show rate, cancellation rate, and confirmation response rate.',
          'Use these metrics to optimize peak slots and staffing plans.',
        ],
      },
    ],
  },
  {
    slug: 'how-to-setup-liff-booking-correctly',
    title: 'How to Set Up LIFF Correctly for Booking Pages',
    description: 'Checklist for LIFF setup: IDs, endpoint URLs, and separate LIFF apps for booking/member flows.',
    category: 'Setup Guide',
    publishedAt: '2026-05-10',
    readingMinutes: 7,
    keywords: ['liff setup', 'invalid liff id', 'line liff booking'],
    sections: [
      {
        heading: 'Basic LIFF Setup',
        body: [
          'Ensure endpoint URLs match your production domain exactly.',
          'Validate whether the flow is opened from LINE app or browser as designed.',
        ],
      },
      {
        heading: 'Separate LIFF Apps by Use Case',
        body: [
          'Booking and member pages can use different LIFF IDs.',
          'Use separate env vars such as NEXT_PUBLIC_LIFF_BOOKING_ID and NEXT_PUBLIC_LIFF_MEMBER_ID.',
        ],
      },
      {
        heading: 'Debugging Invalid LIFF ID',
        body: [
          'Verify LIFF ID in DB/ENV against the actual deployed LIFF app.',
          'Verify rich menu URL format: https://liff.line.me/{LIFF_ID}?shop_key=...',
        ],
      },
    ],
  },
];

export function getBlogBySlugEn(slug: string) {
  return blogPostsEn.find((p) => p.slug === slug) ?? null;
}

