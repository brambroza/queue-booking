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
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://queue-booking-line.vercel.app'),
  title: 'Queue Booking',
  description: 'Queue booking platform for LINE OA',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body className={kanit.variable}>
        <I18nProvider>
          <MuiAppProvider>
            <ToastProvider>{children}</ToastProvider>
          </MuiAppProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
