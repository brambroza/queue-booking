import type { BlogPost } from '@/components/public/blog-content';

export const blogPostsEn: BlogPost[] = [
  {
    slug: 'line-msgapi-liff-login-richmenu-setup-guide',
    title: 'Production Setup Guide: LINE Messaging API + LIFF + LINE Login + Rich Menu',
    description: 'Step-by-step setup for LINE queue booking: webhook, access token, booking/member LIFF apps, LINE Login, and rich menu links.',
    category: 'Setup Guide',
    publishedAt: '2026-05-14',
    readingMinutes: 10,
    keywords: ['line messaging api', 'liff setup', 'line login setup', 'rich menu setup', 'line webhook'],
    assets: {
      pdfUrl: '/docs/line-setup-guide.pdf',
      pdfLabel: 'Download LINE setup guide (PDF)',
      images: [
        {
          src: '/images/blog/line-setup/step-webhook-msgapi.jpg',
          alt: 'LINE Messaging API Webhook settings',
          caption: 'Messaging API and webhook URL setup example',
        },
        {
          src: '/images/blog/line-setup/step-liff-booking.jpg',
          alt: 'LIFF booking app settings',
          caption: 'LIFF app for booking page (/liff/{shopKey})',
        },
        {
          src: '/images/blog/line-setup/step-liff-member.jpg',
          alt: 'LIFF member app settings',
          caption: 'LIFF app for member page (/liff/{shopKey}/member)',
        },
        {
          src: '/images/blog/line-setup/step-richmenu-links.jpg',
          alt: 'Rich menu links for booking and member',
          caption: 'Rich menu with 2 links: Booking and Member',
        },
      ],
    },
    sections: [
      {
        heading: '1) Prepare system values first',
        body: [
          'Prepare your production domain, for example: https://queue-booking-line.vercel.app, and each shop key (e.g., SHOP-TTLS2P).',
          'Confirm required endpoints exist: /api/line/webhook/{shopKey}, /liff/{shopKey}, /liff/{shopKey}/member.',
          'Use 2 LIFF apps: one for booking flow and one for member profile/history flow.',
        ],
      },
      {
        heading: '2) Configure Messaging API and Webhook',
        body: [
          'Open LINE Developers > your OA channel > Messaging API, then copy Channel access token (long-lived) and Channel secret to your system.',
          'Set Webhook URL to https://queue-booking-line.vercel.app/api/line/webhook/{shopKey}.',
          'Enable Use webhook and click Verify.',
          'Disable conflicting OA auto-replies so your system controls responses.',
        ],
      },
      {
        heading: '3) Configure LIFF for Booking',
        body: [
          'Create LIFF app (e.g., queuebooking), Size = Full.',
          'Set Endpoint URL to https://queue-booking-line.vercel.app/liff/{shopKey}.',
          'Recommended scopes: openid, profile, chat_message.write.',
          'Save LIFF ID into your booking LIFF setting / NEXT_PUBLIC_LIFF_BOOKING_ID.',
        ],
      },
      {
        heading: '4) Configure LIFF for Member page',
        body: [
          'Create a second LIFF app (e.g., queuemember), Size = Full.',
          'Set Endpoint URL to https://queue-booking-line.vercel.app/liff/{shopKey}/member.',
          'Use the same scopes if needed (openid, profile, chat_message.write).',
          'Save LIFF ID into member LIFF setting / NEXT_PUBLIC_LIFF_MEMBER_ID.',
        ],
      },
      {
        heading: '5) Configure LINE Login (if using separate channel)',
        body: [
          'If you use a dedicated login channel, configure callback URL on your production domain.',
          'LIFF can be your main login flow; use LINE Login channel only where needed.',
          'Do not mix LIFF IDs across channels without updating endpoint/env values.',
        ],
      },
      {
        heading: '6) Configure Rich Menu links',
        body: [
          'Button 1 (Booking): https://liff.line.me/{LIFF_BOOKING_ID}.',
          'Button 2 (Member): https://liff.line.me/{LIFF_MEMBER_ID}.',
          'Publish and assign the rich menu to your OA.',
          'Test both buttons from LINE mobile app and verify correct destination pages.',
        ],
      },
      {
        heading: '7) Invalid LIFF ID checklist',
        body: [
          'LIFF ID in DB/env must match the exact LIFF app configured in LINE Developers.',
          'Endpoint path must match exactly: booking /liff/{shopKey}, member /liff/{shopKey}/member.',
          'Use HTTPS and production domain consistently.',
          'After env updates on Vercel, redeploy before testing again.',
        ],
      },
      {
        heading: '8) End-to-end verification',
        body: [
          'User taps rich menu > books queue > receives confirmation in LINE.',
          'Booking should appear in portal dashboard immediately.',
          'User taps member menu and can view profile plus booking history.',
        ],
      },
    ],
  },
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
