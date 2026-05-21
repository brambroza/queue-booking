import type { BlogPost } from '@/components/public/blog-content';

export const blogPostsEn: BlogPost[] = [
  {
    slug: 'line-table-booking',
    title: 'LINE Table Booking System for Restaurants: Faster Reservations, Fewer Collisions',
    description: 'Build a LINE-based restaurant table booking flow that reduces phone calls, prevents table collisions, and helps teams respond faster.',
    category: 'Queue Operations',
    publishedAt: '2026-05-21',
    readingMinutes: 7,
    keywords: ['book table via line', 'restaurant table booking system', 'line booking restaurant'],
    sections: [
      {
        heading: 'Why manual reservations break during peak hours',
        body: [
          'Many restaurants still rely on phone reservations and manual chat handling.',
          'When demand spikes, teams miss details, respond slowly, and lose customers before arrival.',
          'The more branches, seat zones, and peak windows you have, the higher the risk of booking errors.',
        ],
      },
      {
        heading: 'Common pain points: phone booking, table collisions, slow admin response',
        body: [
          'Phone booking creates fragmented data and repeated confirmation work.',
          'Table collisions happen when reservations are tracked across multiple channels manually.',
          'Admins get overloaded with repetitive availability questions and cannot respond in time.',
        ],
      },
      {
        heading: 'How LINE table booking solves this structurally',
        body: [
          'Customers can check availability and reserve directly in LINE.',
          'The system validates capacity and timeslot conflicts automatically before confirmation.',
          'Each successful booking instantly notifies both customer and staff for smoother operations.',
        ],
      },
      {
        heading: 'Recommended line booking restaurant flow',
        body: [
          'Customer opens LINE OA > taps booking menu > selects branch, party size, date/time > confirms.',
          'System sends an immediate booking confirmation in chat.',
          'Staff sees new reservations in the dashboard in real time with clear statuses.',
        ],
      },
      {
        heading: 'Business outcomes restaurants should track',
        body: [
          'Lower repeated phone traffic during peak periods.',
          'Fewer booking collisions and better table utilization.',
          'Faster response time and stronger customer experience before arrival.',
        ],
      },
    ],
  },
  {
    slug: 'barber-shop-line-queue-booking-customer-and-owner-flow',
    title: 'Barber Shop Queue Booking Flow: Customer Side and Owner Side',
    description: 'A practical barber-shop flow from LIFF booking (service + barber selection) to back-office notifications, calendar, and digital signage.',
    category: 'Use Case',
    publishedAt: '2026-05-16',
    readingMinutes: 8,
    keywords: ['barber shop', 'line liff booking', 'queue notification', 'digital signage', 'calendar queue'],
    sections: [
      {
        heading: 'Overview: One flow for customers and staff',
        body: [
          'A good setup should connect LINE customer booking and staff operations in one system.',
          'Customer flow: choose service > choose barber > choose date/time > confirm.',
          'Owner/staff flow: instant booking notification, calendar visibility, and a live queue display for in-store operations.',
        ],
      },
      {
        heading: 'Customer flow (LINE + LIFF)',
        body: [
          'Customers tap “Book Queue” from rich menu and open LIFF directly inside LINE.',
          'Step 1 allows selecting both service and barber in a single screen.',
          'Label can be business-specific: “Choose Barber” (barber/nail), “Choose Table” (restaurant), “Choose Room” (meeting room).',
          'Step 2 lets customers pick date and available time slots before final confirmation.',
          'After success, a booking confirmation card is sent back into LINE chat with queue number and appointment details.',
        ],
      },
      {
        heading: 'Owner/staff flow (Portal Dashboard)',
        body: [
          'Each new booking creates a back-office notification so staff can react immediately.',
          'Calendar view helps the team see daily/monthly booking distribution and peak windows.',
          'Daily queue list separates statuses clearly (confirmed, completed, cancelled).',
          'Digital signage shows now-calling and next queue to reduce manual queue shouting at the shop.',
        ],
      },
      {
        heading: 'Recommended setup for barber shops',
        body: [
          'Separate services by real operations (e.g., haircut, haircut+wash, coloring) with correct duration.',
          'Create each barber as a resource so customers can choose a specific person and avoid collisions.',
          'Configure working hours and holidays per branch to ensure accurate slot availability.',
          'Keep notification bell and queue signage active during opening hours for faster front-desk operation.',
        ],
      },
      {
        heading: 'Go-live checklist',
        body: [
          'Complete one full booking test from real LINE mobile.',
          'Verify notification appears and booking lands in calendar/booking list.',
          'Verify queue display reflects now-calling and next queue correctly.',
          'Once all checks pass, the shop can go live with the same tested flow.',
        ],
      },
    ],
  },
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
          'Prepare your production domain, for example: https://queuebooking.com, and each shop key (e.g., SHOP-TTLS2P).',
          'Confirm required endpoints exist: /api/line/webhook/{shopKey}, /liff/{shopKey}, /liff/{shopKey}/member.',
          'Use 2 LIFF apps: one for booking flow and one for member profile/history flow.',
        ],
      },
      {
        heading: '2) Configure Messaging API and Webhook',
        body: [
          'Open LINE Developers > your OA channel > Messaging API, then copy Channel access token (long-lived) and Channel secret to your system.',
          'Set Webhook URL to https://queuebooking.com/api/line/webhook/{shopKey}.',
          'Enable Use webhook and click Verify.',
          'Disable conflicting OA auto-replies so your system controls responses.',
        ],
      },
      {
        heading: '3) Configure LIFF for Booking',
        body: [
          'Create LIFF app (e.g., queuebooking), Size = Full.',
          'Set Endpoint URL to https://queuebooking.com/liff/{shopKey}.',
          'Recommended scopes: openid, profile, chat_message.write.',
          'Save LIFF ID into your booking LIFF setting / NEXT_PUBLIC_LIFF_BOOKING_ID.',
        ],
      },
      {
        heading: '4) Configure LIFF for Member page',
        body: [
          'Create a second LIFF app (e.g., queuemember), Size = Full.',
          'Set Endpoint URL to https://queuebooking.com/liff/{shopKey}/member.',
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
