import './globals.css';
import type { Metadata, Viewport } from 'next';
import { ToastProvider } from '@/components/ui/toast';
import { ConfirmProvider } from '@/components/ui/confirm-dialog';
import { Kanit } from 'next/font/google';
import { I18nProvider } from '@/components/i18n/i18n-provider';
import { MuiAppProvider } from '@/components/theme/mui-provider';
import { PostHogProvider } from '@/components/analytics/posthog-provider';
import { CookieConsent } from '@/components/consent/cookie-consent';
import { AuthLinkRedirect } from '@/components/auth/auth-link-redirect';
import { BreadcrumbSchema } from '@/components/seo/breadcrumb-schema';
import { lightSurface } from '@/theme/tokens';

const kanit = Kanit({
  subsets: ['latin', 'thai'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-sans',
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://queuebooking.com'),
  title: {
    default: 'QueueBooking | ระบบจองคิวออนไลน์ผ่าน LINE OA',
    template: '%s | QueueBooking',
  },
  description: 'ระบบจองคิวผ่าน LINE OA สำหรับทุกธุรกิจ | LINE OA queue booking platform for modern service businesses.',
  applicationName: 'QueueBooking',
  keywords: [
    'ระบบจองคิวผ่าน line oa',
    'จองคิวผ่านไลน์',
    'ระบบจองคิว',
    'line oa booking',
    'liff booking',
    'queue booking',
    'ระบบนัดหมาย line oa',
  ],
  authors: [{ name: 'QueueBooking Team' }],
  creator: 'QueueBooking',
  publisher: 'GO Along Co., Ltd.',
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
    siteName: 'QueueBooking',
    title: 'QueueBooking | ระบบจองคิวออนไลน์ผ่าน LINE OA',
    description: 'ระบบจองคิวผ่าน LINE OA สำหรับทุกธุรกิจ | LINE OA queue booking platform for modern service businesses.',
    url: '/',
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'QueueBooking' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'QueueBooking | ระบบจองคิวออนไลน์ผ่าน LINE OA',
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

/**
 * Mobile viewport: `viewportFit: cover` lets the portal shell pad for iOS
 * safe areas, and `themeColor` tints the browser chrome to match the app
 * background (light by default). Zoom is intentionally left enabled.
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: lightSurface.bg,
};


export default function RootLayout({ children }: { children: React.ReactNode }) {
  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://queuebooking.com';
  // The only Organization block on the site: pages must not repeat it with
  // different values (entity consistency matters to search and AI engines).
  const orgSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${base}/#organization`,
    name: 'QueueBooking',
    alternateName: 'QueueBooking LINE',
    legalName: 'GO Along Co., Ltd.',
    url: base,
    logo: { '@type': 'ImageObject', url: `${base}/apple-touch-icon.png` },
    sameAs: ['https://lin.ee/oViqAoh'],
    areaServed: 'TH',
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
    name: 'QueueBooking',
    alternateName: 'QueueBooking LINE',
    url: base,
    publisher: { '@id': `${base}/#organization` },
    inLanguage: ['th-TH', 'en-US'],
    potentialAction: {
      '@type': 'SearchAction',
      target: `${base}/blog?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };

  // กัน FOUC: ตั้งค่าโหมดสีก่อน hydrate (อ่าน localStorage; ไม่เคยเลือก = light เสมอ ไม่ตาม OS)
  const colorModeScript = `(function(){try{var m=localStorage.getItem('qb-color-mode');if(m!=='dark'){m='light';}var r=document.documentElement;if(m==='dark'){r.classList.add('dark');}r.style.colorScheme=m;r.dataset.theme=m;}catch(e){}})();`;

  return (
    <html lang="th" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: colorModeScript }} />
      </head>
      <body className={kanit.variable}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgSchema) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }} />
        <BreadcrumbSchema />
        <PostHogProvider>
          <I18nProvider>
            <MuiAppProvider>
              <ToastProvider>
                <ConfirmProvider>{children}</ConfirmProvider>
              </ToastProvider>
            <AuthLinkRedirect />
            <CookieConsent />
            </MuiAppProvider>
          </I18nProvider>
        </PostHogProvider>
      </body>
    </html>
  );
}
