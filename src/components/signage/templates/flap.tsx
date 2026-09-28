'use client';

import { useEffect, useRef } from 'react';
import type { SignagePerson } from '@/lib/signage/types';
import type { SignageLabels } from '../labels';
import type { SignageTemplateProps } from '../template-props';
import { SceneShell } from '../scenes/scene-parts';
import { useSceneMotion } from '../scenes/use-scene-motion';
import styles from '../scenes/scenes.module.css';

type FlapRow = { person: SignagePerson; kind: 'go' | 'serving' | 'waiting'; status: string };

/**
 * Rows of the board: queues being called first, then the line in order.
 * @param now Queues being called or served.
 * @param line Queues still waiting.
 * @param labels Label set of the board's language.
 * @param max Most rows the board can show.
 * @returns Rows with their status text.
 */
function buildRows(now: SignagePerson[], line: SignagePerson[], labels: SignageLabels, max: number): FlapRow[] {
  const called: FlapRow[] = now.map((person) =>
    person.status === 'called' ? { person, kind: 'go', status: labels.status_called } : { person, kind: 'serving', status: labels.serving },
  );
  // "Please proceed" rows lead, so the row a customer must act on is always at the top.
  called.sort((a, b) => Number(b.kind === 'go') - Number(a.kind === 'go'));
  const waiting: FlapRow[] = line.map((person) => ({ person, kind: 'waiting', status: labels.status_waiting }));
  return [...called, ...waiting].slice(0, max);
}

/**
 * Flap: a split-flap departure board. Every cell that changes flips over, the
 * way an airport board does.
 *
 * Rows are tied to their position, not to a queue, so when the line moves up
 * each row flips to show the queue that now sits there.
 */
export function FlapTemplate({ data, config, mode, labels, clock, dateLabel }: SignageTemplateProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const gsap = useSceneMotion(mode);
  const shown = useRef<Map<string, string> | null>(null);
  const portrait = config.layout === 'portrait';
  const rows = buildRows(data.now_calling, [...data.next_queue, ...data.waiting_queue], labels, mode === 'thumbnail' ? 5 : portrait ? 10 : 6);
  const signature = rows.map((r) => `${r.person.id}:${r.status}`).join('|');

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const cells = Array.from(root.querySelectorAll<HTMLElement>('[data-flap]'));
    const before = shown.current;
    const after = new Map(cells.map((el) => [el.dataset.flap ?? '', el.textContent ?? '']));
    shown.current = after;
    if (!gsap || !before) return;

    const changed = cells.filter((el) => before.get(el.dataset.flap ?? '') !== (el.textContent ?? ''));
    if (changed.length === 0) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        changed,
        { rotationX: -90, transformOrigin: '50% 50%' },
        { rotationX: 0, duration: 0.5, ease: 'power2.out', clearProps: 'transform', delay: (i, el) => Number((el as HTMLElement).dataset.row ?? 0) * 0.07 },
      );
    }, root);
    return () => ctx.revert();
  }, [gsap, signature]);

  const cell = (row: number, col: string, text: string, className = '') => (
    <div className={`${styles.cell} ${className}`} data-flap={`${row}-${col}`} data-row={row}>
      <b>{text}</b>
    </div>
  );

  return (
    <SceneShell data={data} config={config} clock={clock} dateLabel={dateLabel} bodyClassName={styles.flap} rootRef={rootRef}>
      <div className={styles.flapBoard}>
        <div className={`${styles.flapRow} ${styles.flapHead}`}>
          <span>{labels.queue}</span>
          <span>{labels.name}</span>
          <span className={styles.flapService}>{labels.service}</span>
          <span>{labels.resource}</span>
          <span className={styles.flapTime}>{labels.appointment}</span>
          <span>{labels.status}</span>
        </div>
        {rows.length === 0 ? <div className={styles.empty} style={{ background: 'transparent', color: '#fff' }}>{labels.empty_calling}</div> : null}
        {rows.map((r, i) => (
          <div key={i} className={`${styles.flapRow} ${r.kind === 'go' ? styles.flapGo : r.kind === 'serving' ? styles.flapServing : ''}`}>
            <div className={`${styles.cell} ${styles.cellNum}`} data-flap={`${i}-num`} data-row={i}>
              {r.person.queue_number.slice(0, 5).split('').map((ch, k) => (
                <i key={k}>{ch}</i>
              ))}
            </div>
            {cell(i, 'name', r.person.customer_name ?? '')}
            {cell(i, 'service', r.person.service_name ?? '', styles.flapService)}
            {cell(i, 'resource', r.person.resource_name ?? '—')}
            {cell(i, 'time', r.person.start_time ?? '', styles.flapTime)}
            {cell(i, 'status', r.status)}
          </div>
        ))}
      </div>
    </SceneShell>
  );
}
