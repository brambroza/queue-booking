'use client';

import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Box, Button, Chip, Paper, Popper, Stack, Typography } from '@mui/material';
import { keyframes } from '@mui/material/styles';
import type { Instance } from '@popperjs/core';
import type { TourCandidate, TourStep } from '@/lib/demo/sandbox-sim/tour';

const ring = keyframes`
  0%   { box-shadow: 0 0 0 0 rgba(18,168,98,.55), 0 0 0 9999px rgba(15,23,42,.18); }
  70%  { box-shadow: 0 0 0 14px rgba(18,168,98,0), 0 0 0 9999px rgba(15,23,42,.18); }
  100% { box-shadow: 0 0 0 0 rgba(18,168,98,0), 0 0 0 9999px rgba(15,23,42,.18); }
`;

/** Padding around the ringed element, px. */
const PAD = 6;
/** Space left for the sticky site navbar when scrolling a tall panel into view, px. */
const NAVBAR_OFFSET = 96;
/** Polling interval, ms. */
const TICK_MS = 200;
/** A manual part whose element is missing this many ticks in a row is skipped. */
const MISSING_TICKS_BEFORE_SKIP = 4;

type Found = { candidate: TourCandidate; element: HTMLElement; rect: DOMRect };

/**
 * The part of an element that is actually visible: its box clipped by every
 * scrolling / clipping ancestor (the phone screen scrolls on its own, so a long
 * slot grid would otherwise be ringed past the bottom of the phone).
 */
function visibleRect(element: HTMLElement): DOMRect {
  const r = element.getBoundingClientRect();
  let left = r.left;
  let top = r.top;
  let right = r.right;
  let bottom = r.bottom;
  for (let node = element.parentElement; node && node !== document.body; node = node.parentElement) {
    const style = window.getComputedStyle(node);
    if (/(auto|scroll|hidden|clip)/.test(style.overflowY + style.overflowX)) {
      const c = node.getBoundingClientRect();
      left = Math.max(left, c.left);
      top = Math.max(top, c.top);
      right = Math.min(right, c.right);
      bottom = Math.min(bottom, c.bottom);
    }
  }
  return new DOMRect(left, top, Math.max(0, right - left), Math.max(0, bottom - top));
}

/**
 * First candidate that is on the page and has a size (elements in a hidden
 * mobile tab measure 0×0 and are skipped).
 */
function findTarget(root: HTMLElement | null, step: TourStep): Found | null {
  if (!root) return null;
  for (const candidate of step.candidates) {
    const nodes = root.querySelectorAll<HTMLElement>(`[data-tour="${candidate.target}"]`);
    for (const element of Array.from(nodes)) {
      // Exists = has a size of its own (hidden tabs measure 0×0). It may still be
      // scrolled out of the phone; then `rect` is empty, nothing is drawn, and the
      // scroll effect brings it into view.
      const own = element.getBoundingClientRect();
      if (own.width > 0 && own.height > 0) return { candidate, element, rect: visibleRect(element) };
    }
  }
  return null;
}

/** Identity of what is drawn: target, text and pixel box. */
function foundKey(f: Found | null): string {
  if (!f) return '';
  const r = f.rect;
  return [f.candidate.target, f.candidate.title, f.candidate.body, Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)].join('|');
}

/** True when part of the rect is inside the viewport. */
function inViewport(rect: DOMRect): boolean {
  return rect.bottom > 0 && rect.right > 0 && rect.top < window.innerHeight && rect.left < window.innerWidth;
}

/**
 * Coach-mark overlay: rings the part being explained or the control to press
 * next, with a tooltip. Never blocks clicks — the ring and dim layer have
 * `pointer-events: none`, so the visitor presses the real control.
 *
 * The parent recomputes the step from sandbox state; this component finds the
 * element (`data-tour` inside `rootRef`), follows it while the page or the phone
 * scrolls, and skips an explain part whose element is not on screen.
 *
 * @param rootRef - Sandbox root; targets are looked up inside it only.
 * @param step - Current step from `tourStep`.
 * @param onNext - Advance an explain step.
 * @param onSkipExplain - Skip the rest of the current explain sequence.
 * @param onAgain - Final step: start another booking path.
 * @param onClose - Turn the tour off.
 */
export function SandboxTour({
  rootRef,
  step,
  onNext,
  onSkipExplain,
  onAgain,
  onClose,
}: {
  rootRef: RefObject<HTMLElement | null>;
  step: TourStep;
  onNext?: () => void;
  onSkipExplain?: () => void;
  onAgain?: () => void;
  onClose: () => void;
}) {
  const [found, setFound] = useState<Found | null>(null);
  const popperRef = useRef<Instance | null>(null);
  const scrolledFor = useRef<string>('');
  const stepRef = useRef(step);
  const nextRef = useRef(onNext);
  stepRef.current = step;
  nextRef.current = onNext;

  useEffect(() => {
    let lastKey = '';
    let missing = 0;
    let skipped = false;
    const tick = () => {
      const current = stepRef.current;
      const next = findTarget(rootRef.current, current);
      if (!next && current.manual && !skipped) {
        missing += 1;
        if (missing >= MISSING_TICKS_BEFORE_SKIP) {
          skipped = true;
          nextRef.current?.();
        }
      } else if (next) {
        missing = 0;
      }
      const key = foundKey(next);
      if (key !== lastKey) {
        lastKey = key;
        setFound(next);
      }
    };
    tick();
    const id = window.setInterval(tick, TICK_MS);
    window.addEventListener('scroll', tick, true);
    window.addEventListener('resize', tick);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('scroll', tick, true);
      window.removeEventListener('resize', tick);
    };
  }, [rootRef, step.id]);

  // Bring a new target into view once, but only while the visitor is looking at the sandbox.
  useEffect(() => {
    if (!found) return;
    const key = `${step.id}:${found.candidate.target}`;
    if (scrolledFor.current === key) return;
    scrolledFor.current = key;
    const root = rootRef.current?.getBoundingClientRect();
    if (!root || !inViewport(root)) return;
    const r = found.element.getBoundingClientRect();
    const shown = visibleRect(found.element);
    // Off the page, or partly hidden inside the phone's own scroll area.
    const fullyVisible = r.top >= 80 && r.bottom <= window.innerHeight - 16 && shown.height >= Math.min(r.height, 120) - 1;
    if (!fullyVisible) {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const behavior = reduce ? 'auto' : 'smooth';
      if (r.height > window.innerHeight * 0.6) {
        // Tall panels: show their header just under the sticky navbar instead of their middle.
        window.scrollTo({ top: window.scrollY + r.top - NAVBAR_OFFSET, behavior });
      } else {
        found.element.scrollIntoView({ block: 'center', behavior });
      }
    }
  }, [found, step.id, rootRef]);

  useEffect(() => {
    void popperRef.current?.update();
  }, [found]);

  const anchor = useMemo(
    () => (found ? { getBoundingClientRect: () => visibleRect(found.element), contextElement: found.element } : null),
    [found],
  );

  if (typeof document === 'undefined' || !found || !anchor || found.rect.height === 0 || !inViewport(found.rect)) return null;
  const { rect, candidate } = found;
  const pos = step.explainPos;
  const lastPart = pos ? pos.index >= pos.count - 1 : true;

  return (
    <>
      {createPortal(
        <Box
          aria-hidden
          sx={{
            position: 'fixed',
            left: rect.left - PAD,
            top: rect.top - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            borderRadius: '14px',
            border: step.manual ? '3px dashed #12a862' : '3px solid #12a862',
            pointerEvents: 'none',
            zIndex: 1250,
            animation: `${ring} 1.6s ease-out infinite`,
            transition: 'left 160ms ease, top 160ms ease, width 160ms ease, height 160ms ease',
            '@media (prefers-reduced-motion: reduce)': { animation: 'none', boxShadow: '0 0 0 9999px rgba(15,23,42,.18)', transition: 'none' },
          }}
        />,
        document.body,
      )}
      <Popper
        open
        anchorEl={anchor}
        placement="bottom"
        popperRef={popperRef}
        sx={{ zIndex: 1251, maxWidth: 'min(360px, calc(100vw - 24px))' }}
        modifiers={[
          { name: 'offset', options: { offset: [0, PAD + 12] } },
          { name: 'flip', options: { fallbackPlacements: ['top', 'right', 'left'] } },
          { name: 'preventOverflow', options: { padding: 12 } },
        ]}
      >
        <Paper data-tour-current={candidate.target} elevation={8} role="dialog" aria-modal={false} aria-labelledby="sandbox-tour-title" sx={{ p: 2, borderRadius: 3, border: '1px solid', borderColor: 'primary.light' }}>
          <Stack spacing={1}>
            <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
              <Chip size="small" color="primary" label={`ขั้น ${step.milestone}/${step.total}`} sx={{ fontWeight: 700 }} />
              {pos ? (
                <Chip size="small" variant="outlined" label={`อธิบาย ${pos.index + 1}/${pos.count}`} />
              ) : step.final ? null : (
                <Chip size="small" variant="outlined" color="success" label="ลองกดเลย" />
              )}
            </Stack>
            <Typography id="sandbox-tour-title" sx={{ fontWeight: 800 }} aria-live="polite">
              {step.manual ? '💡' : '👉'} {candidate.title}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {candidate.body}
            </Typography>
            {candidate.tips?.length ? (
              <Box component="ul" sx={{ m: 0, pl: 2.25, display: 'grid', gap: 0.5 }}>
                {candidate.tips.map((tip) => (
                  <Typography key={tip} component="li" variant="caption" sx={{ lineHeight: 1.5 }}>
                    {tip}
                  </Typography>
                ))}
              </Box>
            ) : null}
            <Stack direction="row" spacing={1} justifyContent="flex-end" alignItems="center" flexWrap="wrap" useFlexGap sx={{ pt: 0.5 }}>
              {step.final ? (
                <>
                  <Button size="small" color="inherit" onClick={onClose}>
                    จบการแนะนำ
                  </Button>
                  {onAgain ? (
                    <Button size="small" variant="contained" onClick={onAgain}>
                      จองอีกแบบ
                    </Button>
                  ) : null}
                </>
              ) : (
                <>
                  <Button size="small" color="inherit" onClick={onClose} sx={{ mr: 'auto' }}>
                    ปิดคำแนะนำ
                  </Button>
                  {step.manual && onSkipExplain && !lastPart ? (
                    <Button size="small" onClick={onSkipExplain}>
                      ข้ามคำอธิบาย
                    </Button>
                  ) : null}
                  {step.manual && onNext ? (
                    <Button size="small" variant="contained" onClick={onNext}>
                      {lastPart ? 'เข้าใจแล้ว' : 'ถัดไป'}
                    </Button>
                  ) : null}
                </>
              )}
            </Stack>
          </Stack>
        </Paper>
      </Popper>
    </>
  );
}
