'use client';

import { useEffect, useRef, useState } from 'react';
import { BUSINESS_TYPE_LABELS, type BusinessType } from '@/lib/line/rich-menu/business-types';
import { templateForBusiness } from '@/lib/line/rich-menu/templates';
import { LAYOUTS } from '@/lib/line/rich-menu/layouts';
import { renderRichMenu } from '@/lib/line/rich-menu/render';
import { ensureFontsLoaded, loadSvgImage, resolveFontStack } from '@/lib/line/rich-menu/canvas';
import styles from './landing.module.css';

/** Business types shown; order = the industries the site targets first. */
const SHOWN: BusinessType[] = ['clinic', 'restaurant', 'sports_court', 'nail', 'car_care', 'fitness', 'salon', 'pet'];

/** CSS width of one card's drawing. */
const CARD_WIDTH = 298;

/**
 * One rich menu drawn with the production renderer (`renderRichMenu`) from the
 * master template of that business type, exactly what the builder publishes to
 * LINE. Draws once the gallery scrolls into view.
 */
function GalleryCard({ type, draw }: { type: BusinessType; draw: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [done, setDone] = useState(false);
  const config = templateForBusiness(type);
  const layout = LAYOUTS[config.layout];

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !draw || done) return;
    let cancelled = false;
    (async () => {
      const fontStack = resolveFontStack();
      await ensureFontsLoaded(fontStack);
      if (cancelled) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const scale = (CARD_WIDTH * dpr) / layout.width;
      canvas.width = Math.round(layout.width * scale);
      canvas.height = Math.round(layout.height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      await renderRichMenu(ctx, config, { scale, fontStack, loadImage: loadSvgImage, shopName: 'ร้านของคุณ' });
      if (!cancelled) setDone(true);
    })().catch(() => {
      /* The tinted placeholder stays if a draw fails. */
    });
    return () => {
      cancelled = true;
    };
    // config is derived from `type` and stable per render; layout from config.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draw, done, type]);

  return (
    <article className={styles.galleryCard}>
      <div className={styles.galleryTop}>
        <b>{BUSINESS_TYPE_LABELS[type]}</b>
        <span>{config.buttons.length} ปุ่ม</span>
      </div>
      <canvas
        ref={ref}
        className={styles.galleryCanvas}
        role="img"
        aria-label={`ตัวอย่าง Rich Menu สำหรับ${BUSINESS_TYPE_LABELS[type]}: ${config.buttons.map((b) => b.label).join(', ')}`}
      />
    </article>
  );
}

/** Horizontal strip of ready-made rich menus, one per business type. */
export function LandingRichMenuGallery() {
  const ref = useRef<HTMLDivElement>(null);
  const [draw, setDraw] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setDraw(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setDraw(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={styles.gallery} aria-label="ตัวอย่าง Rich Menu ตามประเภทธุรกิจ">
      {SHOWN.map((type) => (
        <GalleryCard key={type} type={type} draw={draw} />
      ))}
    </div>
  );
}
