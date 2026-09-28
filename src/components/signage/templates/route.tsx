'use client';

import { useRef } from 'react';
import type { SignagePerson } from '@/lib/signage/types';
import { minutesUntil, waitingLine } from '@/lib/signage/scene';
import type { SignageLabels } from '../labels';
import type { SignageTemplateProps } from '../template-props';
import { HeroPanel, SceneShell, useArtId, useNowMinutes } from '../scenes/scene-parts';
import { playCallEntrance, useDeparted, useEntrance, useMoveTo, useSceneMotion, type MovePoint } from '../scenes/use-scene-motion';
import styles from '../scenes/scenes.module.css';

/**
 * Time left until a queue's appointment, in words.
 * Within the hour it counts down; further out the appointment time itself reads better.
 * @param person Queue to describe.
 * @param now Current Bangkok time in minutes.
 * @param labels Label set of the board's language.
 * @returns Text such as "อีก 25 นาที" or "18:30", or an empty string without a start time.
 */
function waitText(person: SignagePerson, now: number, labels: SignageLabels): string {
  const left = minutesUntil(person, now);
  if (left === null) return '';
  if (left === 0) return labels.time_reached;
  return left > 60 ? person.start_time ?? '' : labels.minutes_left.replace('{n}', String(left));
}

/**
 * Route: the queue as stops on a line that ends at "now calling". Made for
 * businesses where customers wait in order.
 *
 * The time under each stop counts down to the booking's own appointment time.
 * It is not an estimate of when the shop will actually reach that queue.
 */
export function RouteTemplate({ data, config, mode, labels, clock, dateLabel }: SignageTemplateProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const uid = useArtId();
  const gsap = useSceneMotion(mode);
  const now = useNowMinutes(data, mode);
  const portrait = config.layout === 'portrait';

  const first = portrait ? 44 : 52;
  const gap = portrait ? 10.4 : 11.4;
  const count = portrait ? 4 : 5;
  const line = waitingLine(data);
  const stops = line.slice(0, count).map((person, i) => ({ id: person.id, person, x: first - i * gap, index: i }));
  // A queue that was just called travels on to the end of the line before it disappears.
  const arrived = useDeparted(stops).map((s) => ({ ...s, x: first + gap, index: -1 }));
  const leaving = new Set(arrived.map((s) => s.id));
  const everyone = [...stops, ...arrived.filter((a) => !stops.some((s) => s.id === a.id))];

  const positions: Record<string, MovePoint> = {};
  for (const s of everyone) positions[s.id] = { x: s.x, y: 0 };
  useMoveTo(rootRef, gsap, positions, { enterFrom: { x: first - count * gap, y: 0 }, leaving });
  useEntrance(rootRef, gsap, data.now_calling[0]?.id ?? '', playCallEntrance);

  const hidden = Math.max(0, data.totals.waiting - stops.length);
  const head = line[0] ?? null;

  return (
    <SceneShell data={data} config={config} clock={clock} dateLabel={dateLabel} bodyClassName={styles.route} rootRef={rootRef}>
      <div className={styles.routeMap}>
        <h4>{labels.next_queue}</h4>
        <p className={styles.lead}>
          {head ? (
            <>
              <b>{head.queue_number}</b> {waitText(head, now, labels)}
            </>
          ) : (
            labels.empty_next
          )}
        </p>
        <div className={styles.line} />
        {hidden > 0 ? <span className={styles.routeMore}>{labels.more_queues.replace('{n}', String(hidden))}</span> : null}
        {everyone.map((s) => (
          <div key={s.id} data-move-id={s.id} className={`${styles.stop} ${s.index === 0 ? styles.stopFirst : ''}`} style={{ left: `${s.x}em`, opacity: leaving.has(s.id) && !gsap ? 0 : undefined }}>
            <div className={styles.stopNum}>{s.person.queue_number}</div>
            <div className={styles.stopDot} />
            {s.person.customer_name ? <div className={styles.stopName}>{s.person.customer_name}</div> : null}
            <div className={styles.stopWait}>{waitText(s.person, now, labels)}</div>
          </div>
        ))}
      </div>

      <HeroPanel data={data} config={config} labels={labels} uid={uid} variant="tall" alsoLimit={1} className={styles.arrive} />

      <div className={styles.stats}>
        <div className={styles.stat}>
          <b>{data.totals.waiting}</b>
          <small>{labels.waiting}</small>
        </div>
        <div className={styles.stat}>
          <b>{data.totals.served_today}</b>
          <small>{labels.served_today}</small>
        </div>
        {config.announcement_text ? (
          <div className={`${styles.stat} ${styles.statWide}`}>
            <small>{config.announcement_text}</small>
          </div>
        ) : null}
      </div>
    </SceneShell>
  );
}
