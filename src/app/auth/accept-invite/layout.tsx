import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ตั้งรหัสผ่าน',
  robots: { index: false, follow: false },
};

export default function AcceptInviteLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
