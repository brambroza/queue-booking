'use client';

import { useRef } from 'react';
import { buildTimeline, toLabel, toMinutes, type TimelineState } from '@/lib/signage/scene';
import type { SignageTemplateProps } from '../template-props';
import { GoTag, SceneShell, useNowMinutes } from '../scenes/scene-parts';
import { playCallEntrance, useEntrance, useMoveTo, useSceneMotion } from '../scenes/use-scene-motion';
import styles from '../scenes/scenes.module.css';

const BLOCK_CLASS: Record<TimelineState, string> = {
  done: styles.blockDone,
  now: styles.blockNow,
  soon: styles.blockSoon,
  later: styles.blockLater,
};

/**
 * Timeline: one row per service point, time running left to right. Made for
 * businesses that book a place for a time slot: courts, rooms, clinics.
 *
 * Free stretches are drawn so a passer-by can see what is still bookable. They
 * are the gaps between today's bookings, not a check against opening hours, so a
 * gap can extend past closing time.
 */
export function TimelineTemplate({ data, config, mode, labels, clock, dateLabel }: SignageTemplateProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const gsap = useSceneMotion(mode);
  const now = useNowMinutes(data, mode);
  const portrait = config.layout === 'portrait';
  const timeline = buildTimeline(data, now, portrait ? 7 : 4);
  const span = timeline.end - timeline.start;
  const pct = (minutes: number) => ((minutes - timeline.start) / span) * 100;

  const hero = data.now_calling[0] ?? null;
  const upcoming = data.schedule.find((p) => (toMinutes(p.start_time) ?? -1) > now && p.id !== hero?.id) ?? null;

  // The marker's resting place is a CSS percentage; the move is expressed in board units.
  const trackUnits = portrait ? 56.25 - 4.4 - 9 : 100 - 4.4 - 12;
  useMoveTo(rootRef, gsap, { now: { x: (pct(now) / 100) * trackUnits, y: 0 } });
  useEntrance(rootRef, gsap, hero?.id ?? '', playCallEntrance);

  const stateLabel: Record<TimelineState, string> = { done: labels.done, now: labels.in_use, soon: labels.get_ready, later: '' };
  const hours: number[] = [];
  for (let m = timeline.start; m <= timeline.end; m += 60) hours.push(m);
  const labelColumn = portrait ? '9em' : '12em';

  return (
    <SceneShell data={data} config={config} clock={clock} dateLabel={dateLabel} bodyClassName={styles.timeline} rootRef={rootRef}>
      <div className={styles.strip}>
        <span className={styles.label}>{labels.now_calling}</span>
        {hero ? (
          <>
            <span className={styles.stripNum} data-hero-num>{hero.queue_number}</span>
            <span className={styles.stripWho} data-hero-text>
              {hero.customer_name ? <b>{hero.customer_name}</b> : null}
              {hero.start_time ? <small>{hero.end_time ? `${hero.start_time}–${hero.end_time}` : hero.start_time}</small> : null}
            </span>
            <GoTag person={hero} labels={labels} />
          </>
        ) : (
          <span className={styles.stripWho}>
            <b>{labels.empty_calling}</b>
          </span>
        )}
        {upcoming ? (
          <span className={styles.stripNext}>
            <small>
              {labels.next_queue} {upcoming.start_time}
            </small>
            <b>
              {upcoming.queue_number}
              {upcoming.resource_name ? ` · ${upcoming.resource_name}` : ''}
            </b>
          </span>
        ) : null}
      </div>

      <div className={styles.tl}>
        <div />
        <div className={styles.axis}>
          {hours.map((m) => (
            <span key={m} style={{ left: `${pct(m)}%` }}>{toLabel(m)}</span>
          ))}
        </div>
        {timeline.rows.map((row) => (
          <div key={row.name} style={{ display: 'contents' }}>
            <div className={styles.rowName}>{row.name}</div>
            <div className={styles.track}>
              {hours.slice(1, -1).map((m) => (
                <i key={m} className={styles.gridLine} style={{ left: `${pct(m)}%` }} />
              ))}
              {row.gaps.map((gap) => (
                <div key={`free-${gap.start}`} className={`${styles.block} ${styles.blockFree}`} style={{ left: `${pct(gap.start)}%`, width: `calc(${pct(gap.end) - pct(gap.start)}% - 0.4em)` }}>
                  <b>{labels.free}</b>
                  {gap.end - gap.start >= 60 ? <small>{toLabel(gap.start)}–{toLabel(gap.end)}</small> : null}
                </div>
              ))}
              {row.blocks.map((b) => (
                <div key={b.id} className={`${styles.block} ${BLOCK_CLASS[b.state]}`} style={{ left: `${pct(b.start)}%`, width: `calc(${pct(b.end) - pct(b.start)}% - 0.4em)` }}>
                  <b>
                    {b.queue_number}
                    {b.customer_name ? ` ${b.customer_name}` : ''}
                  </b>
                  <small>{stateLabel[b.state] || `${toLabel(b.start)}–${toLabel(b.end)}`}</small>
                </div>
              ))}
            </div>
          </div>
        ))}
        {timeline.rows.length === 0 ? <div className={styles.empty} style={{ gridColumn: '1 / -1' }}>{labels.empty_next}</div> : null}
        <div className={styles.now} data-move-id="now" style={{ left: `calc(${labelColumn} + (100% - ${labelColumn}) * ${pct(now) / 100})` }}>
          <b>
            {labels.now} {toLabel(now)}
          </b>
          <i />
        </div>
      </div>

      <div className={styles.legend}>
        <span><i style={{ background: 'var(--sg-accent)' }} />{labels.in_use}</span>
        <span><i style={{ background: 'var(--sg-highlight)' }} />{labels.get_ready}</span>
        <span><i style={{ border: '0.15em solid var(--sg-accent)' }} />{labels.booked}</span>
        <span><i style={{ border: '0.15em dashed var(--sg-line)' }} />{labels.free_bookable}</span>
      </div>
    </SceneShell>
  );
}
