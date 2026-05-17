import './globals.css';
import type { Metadata } from 'next';
import { ToastProvider } from '@/components/ui/toast';
import { Kanit } from 'next/font/google';
import { I18nProvider } from '@/components/i18n/i18n-provider';
import { MuiAppProvider } from '@/components/theme/mui-provider';

const kanit = Kanit({
  subsets: ['latin', 'thai'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-sans',
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://queuebooking.com'),
  title: {
    default: 'QueueBooking LINE | ระบบจองคิวผ่าน LINE OA',
    template: '%s | QueueBooking LINE',
  },
  description: 'ระบบจองคิวผ่าน LINE OA สำหรับทุกธุรกิจ | LINE OA queue booking platform for modern service businesses.',
  applicationName: 'QueueBooking LINE',
  keywords: [
    'ระบบจองคิวผ่าน line oa',
    'ระบบจองคิว',
    'line oa booking',
    'liff booking',
    'queue booking',
    'ระบบนัดหมาย line oa',
  ],
  authors: [{ name: 'QueueBooking LINE Team' }],
  creator: 'QueueBooking LINE',
  publisher: 'QueueBooking LINE',
  alternates: {
    canonical: '/',
    languages: {
      'th-TH': '/',
      'en-US': '/en',
      'x-default': '/',
    },
  },
  openGraph: {
    type: 'website',
    locale: 'th_TH',
    alternateLocale: ['en_US'],
    siteName: 'QueueBooking LINE',
    title: 'QueueBooking LINE | ระบบจองคิวผ่าน LINE OA',
    description: 'ระบบจองคิวผ่าน LINE OA สำหรับทุกธุรกิจ | LINE OA queue booking platform for modern service businesses.',
    url: '/',
    images: [{ url: '/og-image', width: 1200, height: 630, alt: 'QueueBooking LINE' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'QueueBooking LINE | ระบบจองคิวผ่าน LINE OA',
    description: 'ระบบจองคิวผ่าน LINE OA สำหรับทุกธุรกิจ | LINE OA queue booking platform.',
    images: ['/twitter-image'],
  },
 icons: {
  icon: [
    { url: '/favicon.ico', sizes: 'any' },
    { url: '/favicon.png', type: 'image/png', sizes: '48x48' },
    { url: '/favicon.png', type: 'image/png', sizes: '192x192' },
  ],
  shortcut: '/favicon.ico',
  apple: '/apple-touch-icon.png',
},
  verification: {
    google: 'vSwRXNYx8325qISY5YeR3oEyPIOGDMHUBKVrrRGXAd4',
  },
};


export default function RootLayout({ children }: { children: React.ReactNode }) {
  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://queuebooking.com';
  const orgSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'QueueBooking LINE',
    url: base,
    contactPoint: [
      {
        '@type': 'ContactPoint',
        contactType: 'sales',
        email: 'amnart.gl@gmail.com',
        telephone: '+66-85-608-3298',
        areaServed: 'TH',
        availableLanguage: ['th', 'en'],
      },
    ],
  };

  const websiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'QueueBooking LINE',
    url: base,
    inLanguage: ['th-TH', 'en-US'],
    potentialAction: {
      '@type': 'SearchAction',
      target: `${base}/blog?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };

  return (
    <html lang="th">
      <body className={kanit.variable}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgSchema) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }} />
        <I18nProvider>
          <MuiAppProvider>
            <ToastProvider>{children}</ToastProvider>
          </MuiAppProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
