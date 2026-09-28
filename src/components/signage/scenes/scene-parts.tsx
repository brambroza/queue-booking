'use client';

import { useEffect, useId, useState, type ReactNode, type Ref } from 'react';
import type { SignageConfig, SignageData, SignagePerson } from '@/lib/signage/types';
import { bangkokMinutes } from '@/lib/signage/scene';
import type { SignageLabels } from '../labels';
import type { SignageMode } from '../parts';
import { QrPanel } from '../parts';
import { sceneArtFor, sceneMarkup, stationMarkup, type SceneArtKey } from './scene-art';
import styles from './scenes.module.css';

/**
 * Current Bangkok time in minutes, refreshed every half minute.
 * Thumbnails and the first server render use the time the data was generated,
 * so the markup is the same on server and client.
 * @param data Signage payload; its `generated_at` seeds the value.
 * @param mode Signage render mode.
 * @returns Minutes since Bangkok midnight.
 */
export function useNowMinutes(data: Pick<SignageData, 'generated_at'>, mode: SignageMode): number {
  const seed = bangkokMinutes(new Date(data.generated_at));
  const [now, setNow] = useState(seed);

  useEffect(() => {
    if (mode === 'thumbnail') {
      setNow(seed);
      return;
    }
    const tick = () => setNow(bangkokMinutes(new Date()));
    tick();
    const timer = setInterval(tick, 30_000);
    return () => clearInterval(timer);
  }, [mode, seed]);

  return mode === 'thumbnail' ? seed : now;
}

/**
 * Id suffix safe to use inside SVG `url(#...)` references.
 * @returns A stable per-instance suffix.
 */
export function useArtId(): string {
  return useId().replace(/[^a-zA-Z0-9]/g, '');
}

export type SceneShellProps = {
  data: SignageData;
  config: SignageConfig;
  clock: string | null;
  dateLabel: string;
  /** Class that sets the grid of the body for one template. */
  bodyClassName: string;
  rootRef?: Ref<HTMLDivElement>;
  children: ReactNode;
};

/**
 * Frame shared by every scene template: flat background, header, body.
 * One `em` inside it is one board unit, so the templates size everything in `em`.
 */
export function SceneShell({ data, config, clock, dateLabel, bodyClassName, rootRef, children }: SceneShellProps) {
  const initial = data.shop.name.trim().slice(0, 1).toUpperCase() || 'Q';
  return (
    <div className={styles.scene} data-layout={config.layout} ref={rootRef}>
      <header className={styles.head}>
        {config.show_logo ? (
          data.shop.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- remote shop logos have no configured host allowlist
            <img className={styles.logo} src={data.shop.logo_url} alt="" />
          ) : (
            <span className={styles.logo} aria-hidden="true">
              <span>{initial}</span>
            </span>
          )
        ) : null}
        <div className={styles.shop}>
          <b>{data.shop.name || 'Queue Display'}</b>
          {data.branch ? <small>{data.branch.name}</small> : null}
        </div>
        <div className={styles.clock}>
          {config.show_clock ? <b>{clock ? clock.slice(0, 5) : '--:--'}</b> : null}
          <small>{dateLabel}</small>
        </div>
      </header>
      <div className={`${styles.body} ${bodyClassName}`}>{children}</div>
    </div>
  );
}

/** Artwork of the theme, or nothing when the theme has none. */
export function SceneArt({ config, uid, viewBox = '0 0 620 360', fit = 'xMaxYMax slice' }: { config: SignageConfig; uid: string; viewBox?: string; fit?: string }) {
  const key = sceneArtFor(config.theme);
  if (!key) return null;
  return (
    <div className={styles.art} aria-hidden="true">
      {/* Fixed markup from scene-art.ts, no user input. */}
      <svg viewBox={viewBox} preserveAspectRatio={fit} dangerouslySetInnerHTML={{ __html: sceneMarkup(key, uid) }} />
    </div>
  );
}

/** Drawing of one service point for the theme, or a plain block when the theme has none. */
export function StationArt({ artKey }: { artKey: SceneArtKey | null }) {
  if (!artKey) return <span className={styles.stationBlock} aria-hidden="true" />;
  // Fixed markup from scene-art.ts, no user input.
  return <svg viewBox="0 0 100 100" aria-hidden="true" dangerouslySetInnerHTML={{ __html: stationMarkup(artKey) }} />;
}

/** "Please proceed to …" for a called queue, or nothing when it has no service point. */
export function GoTag({ person, labels, className }: { person: SignagePerson; labels: SignageLabels; className?: string }) {
  if (!person.resource_name) return null;
  return (
    <span className={`${styles.pill} ${className ?? ''}`} data-hero-go>
      {labels.please_proceed} {person.resource_name}
    </span>
  );
}

export type HeroPanelProps = {
  data: SignageData;
  config: SignageConfig;
  labels: SignageLabels;
  uid: string;
  /** `tall` stacks number over details; `wide` puts them side by side in a low panel. */
  variant: 'tall' | 'wide';
  /** Other queues being called that fit beside the main one. */
  alsoLimit?: number;
  className?: string;
};

/**
 * The "now calling" panel: the largest thing on the board.
 * Shows the most recently called queue, and a quiet message when nobody is being called.
 */
export function HeroPanel({ data, config, labels, uid, variant, alsoLimit = 2, className }: HeroPanelProps) {
  const hero = data.now_calling[0] ?? null;
  const others = data.now_calling.slice(1, 1 + alsoLimit);
  const wide = variant === 'wide';

  return (
    <section className={`${styles.hero} ${wide ? styles.heroWide : styles.heroTall} ${className ?? ''}`}>
      <SceneArt config={config} uid={uid} viewBox={wide ? '330 0 290 360' : '0 0 620 360'} fit={wide ? 'xMaxYMax meet' : 'xMaxYMax slice'} />
      <div className={styles.heroLabel}>
        <span>{labels.now_calling}</span>
        {hero?.start_time ? <span>{hero.start_time}</span> : null}
      </div>
      {hero ? (
        <>
          <div className={styles.heroNum} data-hero-num data-size={hero.queue_number.length > 5 ? 'sm' : hero.queue_number.length > 4 ? 'md' : 'lg'}>
            {hero.queue_number}
          </div>
          <div className={styles.heroInfo}>
            {hero.customer_name ? <div className={styles.heroName} data-hero-text>{hero.customer_name}</div> : null}
            {hero.service_name ? <div className={styles.heroService} data-hero-text>{hero.service_name}</div> : null}
            <div className={styles.go}>
              <GoTag person={hero} labels={labels} />
              {others.map((p) => (
                <span key={p.id} className={styles.also}>
                  <b>{p.queue_number}</b>
                  {p.resource_name ?? ''}
                </span>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className={styles.heroIdle}>{labels.empty_calling}</div>
      )}
    </section>
  );
}

/** QR block for the foot of a scene; nothing when the shop has no booking link. */
export function SceneQr({ data, mode, labels }: { data: SignageData; mode: SignageMode; labels: SignageLabels }) {
  if (!data.qr_url) return null;
  return (
    <div className={styles.qr}>
      <QrPanel url={data.qr_url} mode={mode} labels={labels} />
    </div>
  );
}

/** Stand-in pattern for thumbnails and for the moment before the real code is drawn. Not scannable. */
function QrStandIn() {
  const size = 17;
  const cells: ReactNode[] = [];
  const finder = (x: number, y: number, ox: number, oy: number): boolean | null => {
    const dx = x - ox;
    const dy = y - oy;
    if (dx < 0 || dx > 6 || dy < 0 || dy > 6) return null;
    return dx === 0 || dx === 6 || dy === 0 || dy === 6 || (dx > 1 && dx < 5 && dy > 1 && dy < 5);
  };
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const corner = finder(x, y, 0, 0) ?? finder(x, y, size - 7, 0) ?? finder(x, y, 0, size - 7);
      const quiet = (x < 8 && y < 8) || (x > size - 9 && y < 8) || (x < 8 && y > size - 9);
      const on = corner !== null ? corner : !quiet && (x * 7 + y * 13 + x * y) % 3 === 0;
      if (on) cells.push(<rect key={`${x}-${y}`} x={x + 1} y={y + 1} width="0.94" height="0.94" />);
    }
  }
  return (
    <svg viewBox={`0 0 ${size + 2} ${size + 2}`} aria-hidden="true">
      <rect width={size + 2} height={size + 2} fill="#fff" />
      <g fill="#111">{cells}</g>
    </svg>
  );
}

/**
 * Large booking QR for the invite poster.
 * The code is drawn on the client from the shop's LIFF URL; thumbnails show a stand-in.
 */
export function PosterQr({ url, mode, alt }: { url: string; mode: SignageMode; alt: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (mode === 'thumbnail') return;
    let cancelled = false;
    import('qrcode')
      .then((mod) => mod.toDataURL(url, { width: 768, margin: 1 }))
      .then((result) => {
        if (!cancelled) setDataUrl(result);
      })
      .catch(() => {
        if (!cancelled) setDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [url, mode]);

  if (mode === 'thumbnail' || !dataUrl) return <QrStandIn />;
  // eslint-disable-next-line @next/next/no-img-element -- data URL generated on the client
  return <img src={dataUrl} alt={alt} />;
}
