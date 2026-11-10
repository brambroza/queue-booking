'use client';

import { useEffect } from 'react';
import styles from './landing.module.css';

/**
 * Scroll reveal for the home page as a progressive enhancement.
 *
 * The CSS only hides a `[data-reveal]` block once the root carries
 * `data-motion`, which this component sets after hydration. So without
 * JavaScript, before hydration, in a crawler or a thumbnail, every section is
 * fully visible; with it, blocks below the fold fade in as they enter.
 * Blocks already on screen get the visible class in the same tick, so nothing
 * that was showing ever blinks out. Honors `prefers-reduced-motion`.
 */
export function LandingMotion({ rootId }: { rootId: string }) {
  useEffect(() => {
    const root = document.getElementById(rootId);
    if (!root) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (typeof IntersectionObserver === 'undefined') return;

    const blocks = Array.from(root.querySelectorAll<HTMLElement>('[data-reveal]'));
    const viewport = window.innerHeight;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add(styles.revealed);
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.05 },
    );

    for (const block of blocks) {
      if (block.getBoundingClientRect().top < viewport) block.classList.add(styles.revealed);
      else observer.observe(block);
    }
    root.dataset.motion = 'on';

    return () => {
      observer.disconnect();
      delete root.dataset.motion;
    };
  }, [rootId]);

  return null;
}
