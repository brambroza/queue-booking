'use client';

import { useRef } from 'react';
import { buildStations, waitingLine } from '@/lib/signage/scene';
import type { SignageTemplateProps } from '../template-props';
import { HeroPanel, SceneShell, useArtId } from '../scenes/scene-parts';
import { playCallEntrance, useEntrance, useSceneMotion } from '../scenes/use-scene-motion';
import styles from '../scenes/scenes.module.css';

/** Size of the drawing area in board units; the SVG route uses the same numbers. */
const PLAN = { landscape: { w: 61.5, h: 42.65 }, portrait: { w: 50.85, h: 55.6 } };

/**
 * Floor: every service point at a glance, with a dashed route to the one being
 * called.
 *
 * This is not the shop's real floor plan. The system stores no positions, so the
 * service points are laid out in rows in the order they are named. It answers
 * "which one is free and where do I go", not "where is it in the room".
 */
export function FloorTemplate({ data, config, mode, labels, clock, dateLabel }: SignageTemplateProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const uid = useArtId();
  const gsap = useSceneMotion(mode);
  const portrait = config.layout === 'portrait';
  const plan = portrait ? PLAN.portrait : PLAN.landscape;

  const stations = buildStations(data, 8);
  const perRow = stations.length <= 4 ? Math.max(1, stations.length) : Math.ceil(stations.length / 2);
  const rows = stations.length <= 4 ? 1 : 2;
  const seatW = Math.min(10.5, (plan.w - 6) / perRow - 1.6);
  const seatH = rows === 1 ? 11.5 : 9.4;
  const colW = (plan.w - 5) / perRow;
  const seatAt = (i: number) => ({ x: 2.5 + colW * (i % perRow) + colW / 2, y: 3.6 + Math.floor(i / perRow) * (seatH + 1.6) });

  const benchTop = plan.h - 13.4;
  const waiters = waitingLine(data).slice(0, portrait ? 5 : 6);
  const waiterX = (i: number) => 8.6 + i * 8.4;
  const hidden = Math.max(0, data.totals.waiting - waiters.length);

  const hero = data.now_calling[0] ?? null;
  const target = hero ? stations.findIndex((s) => s.occupant?.id === hero.id) : -1;
  const seatsBottom = 3.6 + rows * seatH + (rows - 1) * 1.6;
  const lane = (seatsBottom + benchTop) / 2;
  const route = target >= 0 ? `M ${waiterX(0)} ${benchTop} L ${waiterX(0)} ${lane} L ${seatAt(target).x} ${lane} L ${seatAt(target).x} ${seatAt(target).y + seatH + 1.6}` : null;

  useEntrance(rootRef, gsap, hero?.id ?? '', (g, root) => {
    playCallEntrance(g, root);
    g.from(root.querySelectorAll('[data-seat-go]'), { scale: 0.8, duration: 0.6, ease: 'back.out(2.2)', transformOrigin: '50% 50%' });
    g.from(root.querySelectorAll('[data-route]'), { opacity: 0, duration: 0.8, delay: 0.3 });
  });

  return (
    <SceneShell data={data} config={config} clock={clock} dateLabel={dateLabel} bodyClassName={styles.floor} rootRef={rootRef}>
      <div className={styles.plan}>
        <div className={styles.bench} style={{ left: '3.6em', top: `${benchTop}em`, width: `${plan.w - 9}em`, height: '9.4em' }} />
        <span className={styles.planTag} style={{ left: `${4 / 1.4}em`, top: `${(benchTop + 9.8) / 1.4}em` }}>
          {labels.waiting_area}
          {hidden > 0 ? ` · ${labels.more_queues.replace('{n}', String(hidden))}` : ''}
        </span>

        {stations.map((s, i) => {
          const at = seatAt(i);
          const called = s.occupant?.id === hero?.id && s.occupant?.status === 'called';
          const cls = !s.occupant ? styles.seatFree : called ? styles.seatGo : styles.seatBusy;
          return (
            <div key={s.name} className={`${styles.seat} ${cls}`} data-seat-go={called ? '' : undefined} style={{ left: `${at.x}em`, top: `${at.y}em`, width: `${seatW}em`, height: `${seatH}em` }}>
              <small>{s.name}</small>
              <b>{s.occupant ? s.occupant.queue_number : labels.free}</b>
              {s.occupant ? <em>{called ? labels.status_called : labels.serving}</em> : null}
            </div>
          );
        })}
        {stations.length === 0 ? <div className={styles.empty} style={{ position: 'absolute', inset: '3em 3em auto 3em' }}>{labels.empty_calling}</div> : null}

        {waiters.map((p, i) => (
          <div key={p.id} className={styles.waiter} style={{ left: `${waiterX(i)}em`, top: `${benchTop + 1.6}em` }}>
            <b>{p.queue_number}</b>
          </div>
        ))}

        {route ? (
          <svg viewBox={`0 0 ${plan.w} ${plan.h}`} preserveAspectRatio="none" aria-hidden="true" data-route>
            <path d={route} fill="none" stroke="var(--sg-text)" strokeWidth="0.45" strokeDasharray="1.2 0.9" strokeLinecap="round" strokeLinejoin="round" />
            <polygon
              points={`${seatAt(target).x - 1},${seatAt(target).y + seatH + 2} ${seatAt(target).x + 1},${seatAt(target).y + seatH + 2} ${seatAt(target).x},${seatAt(target).y + seatH + 0.5}`}
              fill="var(--sg-text)"
            />
          </svg>
        ) : null}
      </div>

      <div className={styles.side}>
        <HeroPanel data={data} config={config} labels={labels} uid={uid} variant="tall" alsoLimit={0} />
        <div className={styles.keys}>
          <div><i style={{ background: 'var(--sg-highlight)', border: '0.2em solid var(--sg-text)' }} />{labels.status_called}</div>
          <div><i style={{ background: 'var(--sg-accent)' }} />{labels.serving}</div>
          <div><i style={{ border: '0.18em solid var(--sg-line)' }} />{labels.free}</div>
          <div><i style={{ borderRadius: '50%', border: '0.18em solid var(--sg-accent)' }} />{labels.waiting} {data.totals.waiting}</div>
        </div>
      </div>
    </SceneShell>
  );
}
