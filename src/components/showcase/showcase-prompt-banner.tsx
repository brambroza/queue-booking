'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, AlertTitle, Button, Stack } from '@mui/material';

/** Record the dismissal; failure only means the banner may show once more. */
async function dismissPrompt() {
  try {
    await fetch('/api/shop-showcase', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dismiss_prompt: true }),
    });
  } catch {
    // Best-effort.
  }
}

/**
 * One-time invitation for existing shop owners to appear on the landing page.
 * Shown until the owner opens or dismisses it (`shop_showcase.prompt_dismissed_at`),
 * never to staff, super_admin or demo shops — the server decides via `prompt`.
 */
export function ShowcasePromptBanner({ hidden = false }: { hidden?: boolean }) {
  const router = useRouter();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (hidden) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch('/api/shop-showcase');
        if (!res.ok) return;
        const json = (await res.json().catch(() => ({}))) as { data?: { prompt?: boolean } };
        if (!cancelled && json.data?.prompt) setShow(true);
      } catch {
        // No banner when the check fails.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hidden]);

  if (!show || hidden) return null;

  function close() {
    setShow(false);
    void dismissPrompt();
  }

  function open() {
    close();
    router.push('/portal/settings#showcase');
  }

  return (
    <Alert
      severity="success"
      onClose={close}
      sx={{ mb: 2, border: '1px solid', borderColor: 'success.light', alignItems: 'center' }}
      action={
        <Stack direction="row" spacing={1} sx={{ mr: 1 }}>
          <Button size="small" variant="contained" color="success" onClick={open}>
            ดูรายละเอียด
          </Button>
          <Button size="small" color="inherit" onClick={close}>
            ไม่สนใจ
          </Button>
        </Stack>
      }
    >
      <AlertTitle sx={{ mb: 0.4 }}>ใหม่: ให้ร้านของคุณขึ้นหน้าแรก GoAlong Queue ฟรี</AlertTitle>
      แสดงชื่อร้าน โลโก้ และปุ่มจองคิวให้ลูกค้าใหม่เห็น เลือกได้ว่าจะแสดงอะไร ทีมงานตรวจก่อนทุกครั้ง และปิดได้ทุกเมื่อ
    </Alert>
  );
}
