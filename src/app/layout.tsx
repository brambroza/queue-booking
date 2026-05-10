import './globals.css';
import type { Metadata } from 'next';
import { ToastProvider } from '@/components/ui/toast';
import { Manrope } from 'next/font/google';
import { I18nProvider } from '@/components/i18n/i18n-provider';
import { MuiAppProvider } from '@/components/theme/mui-provider';

const manrope = Manrope({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'Queue Booking',
  description: 'Queue booking platform for LINE OA',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body className={manrope.variable}>
        <I18nProvider>
          <MuiAppProvider>
            <ToastProvider>{children}</ToastProvider>
          </MuiAppProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
