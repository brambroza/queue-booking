'use client';

import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import type { SignageMode } from '../parts';

type Gsap = typeof import('gsap').gsap;

/** How long a move across the board takes, in seconds. */
export const MOVE_SECONDS = 1.4;

let gsapPromise: Promise<Gsap> | null = null;

/**
 * Load GSAP once, on demand. The classic templates never need it, so it stays
 * out of their bundle.
 * @returns The shared GSAP instance.
 */
function loadGsap(): Promise<Gsap> {
  gsapPromise ??= import('gsap').then((m) => m.gsap);
  return gsapPromise;
}

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/**
 * GSAP for a scene, or `null` when the scene must stay still: thumbnails, and
 * devices that ask for reduced motion.
 * @param mode Signage render mode.
 * @returns GSAP once it has loaded, otherwise `null`.
 */
export function useSceneMotion(mode: SignageMode): Gsap | null {
  const [gsap, setGsap] = useState<Gsap | null>(null);

  useEffect(() => {
    if (mode === 'thumbnail') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    let cancelled = false;
    loadGsap()
      .then((g) => {
        if (!cancelled) setGsap(() => g);
      })
      .catch(() => {
        // Without GSAP the board is simply still; the queue data is unaffected.
      });
    return () => {
      cancelled = true;
    };
  }, [mode]);

  return mode === 'thumbnail' ? null : gsap;
}

/**
 * Pixels per board unit. Scene CSS is written in `em`, and one `em` of the scene
 * root is one unit, so this converts a distance in units into a transform.
 * @param root Scene root element.
 * @returns Pixel size of one unit.
 */
function unitPx(root: HTMLElement): number {
  return Number.parseFloat(getComputedStyle(root).fontSize) || 1;
}

/**
 * Slow looping motion inside the artwork: the barber pole turns, steam rises,
 * a shuttlecock crosses the net. Only elements marked `data-an` move; queue
 * numbers and names never do.
 * @param rootRef Scene root.
 * @param gsap GSAP, or `null` to stay still.
 * @param key Changes when the artwork changes, so the loops restart on the new elements.
 */
export function useAmbientMotion(rootRef: RefObject<HTMLElement | null>, gsap: Gsap | null, key: string): void {
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !gsap) return;
    const ctx = gsap.context(() => {
      const each = (name: string, run: (el: Element, delay: number) => void) => {
        root.querySelectorAll(`[data-an="${name}"]`).forEach((el) => run(el, Number(el.getAttribute('data-delay') ?? 1) - 1));
      };
      each('stripes', (el) => gsap.to(el, { y: 112, duration: 3.2, ease: 'none', repeat: -1 }));
      each('swing', (el, d) => gsap.fromTo(el, { rotation: -4, transformOrigin: '50% 0%' }, { rotation: 4, duration: 4.5 + d, ease: 'sine.inOut', repeat: -1, yoyo: true }));
      each('steam', (el, d) => gsap.fromTo(el, { y: 10, opacity: 0 }, { keyframes: [{ y: -2, opacity: 0.95, duration: 1.2 }, { y: -22, opacity: 0, duration: 2.2 }], repeat: -1, delay: d * 1.1, ease: 'sine.inOut' }));
      each('hand', (el) => gsap.to(el, { rotation: 360, transformOrigin: '50% 100%', duration: 24, ease: 'none', repeat: -1 }));
      each('dot', (el) => gsap.fromTo(el, { x: 0, opacity: 0 }, { keyframes: [{ x: 7, opacity: 1, duration: 0.3 }, { x: 49, opacity: 1, duration: 2 }, { x: 56, opacity: 0, duration: 0.3 }], repeat: -1, ease: 'none' }));
      each('flyx', (el) => gsap.fromTo(el, { x: -60, opacity: 0 }, { keyframes: [{ x: -35, opacity: 1, duration: 0.45 }, { x: 225, opacity: 1, duration: 4.7 }, { x: 250, opacity: 0, duration: 0.45 }], repeat: -1, ease: 'none' }));
      each('flyy', (el) => gsap.fromTo(el, { y: 40, rotation: -20 }, { y: -46, rotation: 24, duration: 2.8, ease: 'sine.inOut', repeat: -1, yoyo: true }));
      each('snip', (el) => gsap.fromTo(el, { rotation: -7, transformOrigin: '50% 50%' }, { rotation: 7, duration: 1.8, ease: 'sine.inOut', repeat: -1, yoyo: true }));
      each('bob', (el) => gsap.to(el, { y: -7, duration: 3.6, ease: 'sine.inOut', repeat: -1, yoyo: true }));
    }, root);
    return () => ctx.revert();
  }, [rootRef, gsap, key]);
}

export type MovePoint = { x: number; y: number };

export type MoveOptions = {
  /** Where a newcomer walks in from, in board units. Omit to fade in on the spot. */
  enterFrom?: MovePoint;
  /** Ids that are on their way out: they fade while they move. */
  leaving?: ReadonlySet<string>;
};

/**
 * Animate elements to the place React has already put them.
 *
 * The scene positions every element with CSS, in board units. After each render
 * this hook looks up where an element was on the previous render and plays the
 * difference as a transform that ends at zero. Because the resting position is
 * plain CSS, the layout stays right when the screen is resized or GSAP is absent.
 *
 * Elements are matched by their `data-move-id` attribute.
 *
 * @param rootRef Scene root; its font size is one board unit.
 * @param gsap GSAP, or `null` to skip animation.
 * @param positions Resting position of every element, by id, in board units.
 * @param options Entry point and the ids that are leaving.
 */
export function useMoveTo(rootRef: RefObject<HTMLElement | null>, gsap: Gsap | null, positions: Record<string, MovePoint>, options: MoveOptions = {}): void {
  const previous = useRef<Record<string, MovePoint> | null>(null);
  const signature = JSON.stringify(positions);
  const { enterFrom, leaving } = options;

  useIsoLayoutEffect(() => {
    const root = rootRef.current;
    const before = previous.current;
    previous.current = positions;
    if (!root || !gsap || !before) return;

    const unit = unitPx(root);
    root.querySelectorAll<HTMLElement>('[data-move-id]').forEach((el) => {
      const id = el.dataset.moveId ?? '';
      const to = positions[id];
      if (!to) return;
      const from = before[id] ?? enterFrom;
      const isNew = !before[id];
      const fades = leaving?.has(id) ?? false;
      if (!from || (from.x === to.x && from.y === to.y && !isNew && !fades)) return;

      gsap.killTweensOf(el);
      gsap.fromTo(
        el,
        { x: (from.x - to.x) * unit, y: (from.y - to.y) * unit, opacity: isNew ? 0 : 1 },
        { x: 0, y: 0, opacity: fades ? 0 : 1, duration: MOVE_SECONDS, ease: 'power2.inOut', clearProps: fades ? '' : 'transform,opacity' },
      );
      const stride = el.querySelector('[data-walk]');
      if (stride) gsap.fromTo(stride, { y: 0 }, { y: -0.28 * unit, duration: 0.17, ease: 'sine.inOut', repeat: Math.round(MOVE_SECONDS / 0.17) - 1, yoyo: true, clearProps: 'transform' });
    });
    // `signature` stands in for `positions`, which is a new object on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootRef, gsap, signature]);
}

/**
 * Keep items that have just disappeared for a moment, so they can be seen leaving.
 * @param items Items currently on the board.
 * @param holdMs How long a departed item stays, in milliseconds.
 * @returns Items that left during the last `holdMs`.
 */
export function useDeparted<T extends { id: string }>(items: T[], holdMs: number = MOVE_SECONDS * 1000 + 200): T[] {
  const [departed, setDeparted] = useState<T[]>([]);
  const last = useRef<T[]>(items);
  const ids = items.map((i) => i.id).join(',');

  useEffect(() => {
    const present = new Set(items.map((i) => i.id));
    const gone = last.current.filter((i) => !present.has(i.id));
    last.current = items;
    if (gone.length === 0) return;
    setDeparted((list) => [...list.filter((i) => !present.has(i.id) && !gone.some((g) => g.id === i.id)), ...gone]);
    const timer = setTimeout(() => setDeparted((list) => list.filter((i) => !gone.some((g) => g.id === i.id))), holdMs);
    return () => clearTimeout(timer);
    // `ids` stands in for `items`, which is a new array on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids, holdMs]);

  return departed;
}

/**
 * Play an entrance on the elements matched by `selector` whenever `key` changes.
 * Nothing plays on the first render, so a board that is just opened is still.
 * @param rootRef Scene root.
 * @param gsap GSAP, or `null` to skip animation.
 * @param key Value that identifies the content, e.g. the id of the queue being called.
 * @param play Builds the entrance.
 */
export function useEntrance(rootRef: RefObject<HTMLElement | null>, gsap: Gsap | null, key: string, play: (gsap: Gsap, root: HTMLElement) => void): void {
  const seen = useRef<string | null>(null);
  const playRef = useRef(play);
  playRef.current = play;

  useIsoLayoutEffect(() => {
    const root = rootRef.current;
    const first = seen.current === null;
    const changed = seen.current !== key;
    seen.current = key;
    if (!root || !gsap || first || !changed) return;
    const ctx = gsap.context(() => playRef.current(gsap, root), root);
    return () => ctx.revert();
  }, [rootRef, gsap, key]);
}

/**
 * Entrance of a newly called queue: the number rises in, then the "please proceed" tag pops.
 * @param gsap GSAP instance.
 * @param root Scene root.
 */
export function playCallEntrance(gsap: Gsap, root: HTMLElement): void {
  gsap.from(root.querySelectorAll('[data-hero-num]'), { yPercent: 38, opacity: 0, duration: 0.7, ease: 'back.out(1.4)' });
  gsap.from(root.querySelectorAll('[data-hero-text]'), { y: '0.6em', opacity: 0, duration: 0.5, delay: 0.3, ease: 'power2.out' });
  gsap.from(root.querySelectorAll('[data-hero-go]'), { scale: 0.6, opacity: 0, duration: 0.5, delay: 0.55, ease: 'back.out(2)' });
}
