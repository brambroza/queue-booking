'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Slide from '@mui/material/Slide';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

type Toast = { id: number; message: string; type: ToastType; open: boolean };

type ToastContextValue = {
  push: (message: string, type?: ToastType) => void;
};

/** How long each severity stays on screen (ms). Errors linger so they can be read. */
const DURATION: Record<ToastType, number> = {
  success: 3000,
  info: 3000,
  warning: 5000,
  error: 6000,
};

/** Max snackbars visible at once; the oldest is dropped beyond this. */
const MAX_VISIBLE = 4;

/** Identical message+type pushed within this window is ignored (double-click guard). */
const DEDUPE_MS = 500;

const ToastContext = createContext<ToastContextValue | null>(null);

/**
 * Global snackbar stack anchored top-right (below the portal topbar).
 * Call sites use `useToast().push(message, type)`; type defaults to 'success'.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const lastPush = useRef<{ key: string; at: number }>({ key: '', at: 0 });
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  /** Start the exit transition; the item is removed on `onExited`. */
  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, open: false } : t)));
  }, []);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (message: string, type: ToastType = 'success') => {
      const key = `${type}:${message}`;
      const now = Date.now();
      if (lastPush.current.key === key && now - lastPush.current.at < DEDUPE_MS) return;
      lastPush.current = { key, at: now };

      const id = now + Math.floor(Math.random() * 1000);
      setToasts((prev) => {
        const next = [...prev, { id, message, type, open: true }];
        const visible = next.filter((t) => t.open);
        if (visible.length <= MAX_VISIBLE) return next;
        const dropIds = new Set(visible.slice(0, visible.length - MAX_VISIBLE).map((t) => t.id));
        return next.filter((t) => !dropIds.has(t.id));
      });
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), DURATION[type]),
      );
    },
    [dismiss],
  );

  useEffect(() => {
    const map = timers.current;
    return () => map.forEach((timer) => clearTimeout(timer));
  }, []);

  // Safety net: a fetch that throws (offline, DNS, CORS) inside a handler without its
  // own catch would otherwise fail silently. Browsers word this TypeError differently.
  useEffect(() => {
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason: unknown = event.reason;
      if (reason instanceof TypeError && /fetch|network|load failed/i.test(reason.message)) {
        push('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง', 'error');
      }
    };
    window.addEventListener('unhandledrejection', onRejection);
    return () => window.removeEventListener('unhandledrejection', onRejection);
  }, [push]);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Box
        aria-live="polite"
        sx={{
          position: 'fixed',
          top: { xs: 76, sm: 84 },
          right: 16,
          left: { xs: 16, sm: 'auto' },
          zIndex: (theme) => theme.zIndex.snackbar,
          display: 'flex',
          flexDirection: 'column',
          alignItems: { xs: 'stretch', sm: 'flex-end' },
          gap: 1,
          pointerEvents: 'none',
        }}
      >
        {toasts.map((t) => (
          <Slide key={t.id} in={t.open} direction="left" appear mountOnEnter unmountOnExit onExited={() => remove(t.id)}>
            <Alert
              variant="filled"
              severity={t.type}
              onClose={() => dismiss(t.id)}
              sx={{
                pointerEvents: 'auto',
                width: { xs: '100%', sm: 'auto' },
                minWidth: { sm: 300 },
                maxWidth: { sm: 420 },
                boxShadow: 6,
                alignItems: 'center',
                '& .MuiAlert-message': { whiteSpace: 'pre-line', wordBreak: 'break-word' },
              }}
            >
              {t.message}
            </Alert>
          </Slide>
        ))}
      </Box>
    </ToastContext.Provider>
  );
}

/** Access the global toast. Must be rendered under `ToastProvider`. */
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
