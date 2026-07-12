'use client';

import { Suspense, useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

/**
 * เริ่มต้น PostHog ฝั่ง client (ทำครั้งเดียวตอน module load)
 * ปิด capture_pageview อัตโนมัติ เพราะ App Router ใช้ client-side routing
 * เราจะ track pageview เองผ่าน PostHogPageView
 */
if (typeof window !== 'undefined' && POSTHOG_KEY && !posthog.__loaded) {
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    defaults: '2026-05-30',
    capture_pageview: false, // จัดการเองใน PostHogPageView (รองรับ SPA navigation)

    // --- Privacy (PDPA): กัน PII ลูกค้าไหลเข้า PostHog ---
    // ปิด session recording ทั้งหมด (ไม่อัดวิดีโอ DOM ที่มีเบอร์/ชื่อลูกค้า)
    disable_session_recording: true,
    // autocapture: ไม่เก็บ text บน element และไม่เก็บ attribute เช่น value/href
    mask_all_text: true,
    mask_all_element_attributes: true,
  });
}

/**
 * ส่ง event `$pageview` ทุกครั้งที่ route เปลี่ยน (รวม query string)
 */
function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!pathname || !POSTHOG_KEY) return;
    let url = window.origin + pathname;
    const qs = searchParams?.toString();
    if (qs) url += `?${qs}`;
    posthog.capture('$pageview', { $current_url: url });
  }, [pathname, searchParams]);

  return null;
}

/**
 * ครอบแอปด้วย PostHog context + pageview tracking
 * ถ้าไม่ได้ตั้งค่า env key จะ render children เฉยๆ (no-op)
 */
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  if (!POSTHOG_KEY) return <>{children}</>;

  return (
    <PHProvider client={posthog}>
      <Suspense fallback={null}>
        <PostHogPageView />
      </Suspense>
      {children}
    </PHProvider>
  );
}
