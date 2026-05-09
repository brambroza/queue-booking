import './globals.css';
import type { Metadata } from 'next';
import { ToastProvider } from '@/components/ui/toast';
import { Manrope } from 'next/font/google';

const manrope = Manrope({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'LINE Queue Booking SaaS',
  description: 'Queue booking platform for LINE OA',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body className={manrope.variable}>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
