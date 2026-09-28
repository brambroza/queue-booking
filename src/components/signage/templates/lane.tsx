'use client';

import { useRef } from 'react';
import type { SignageLayout, SignagePerson } from '@/lib/signage/types';
import { buildStations, waitingLine } from '@/lib/signage/scene';
import type { SignageTemplateProps } from '../template-props';
import { sceneArtFor } from '../scenes/scene-art';
import { HeroPanel, SceneShell, StationArt, useArtId } from '../scenes/scene-parts';
import { playCallEntrance, useAmbientMotion, useDeparted, useEntrance, useMoveTo, useSceneMotion, type MovePoint } from '../scenes/use-scene-motion';
import styles from '../scenes/scenes.module.css';

type LaneGeometry = {
  /** Places in the visible line; the rest are counted in the "+N" badge. */
  slots: number;
  slot: (index: number) => MovePoint;
  stations: MovePoint[];
  stationWidth: number;
  /** Where a customer stands, relative to the service point. */
  serveDx: number;
  /** Size of a figure, as a multiple of one board unit. */
  scale: number;
  entry: MovePoint;
  exitX: number;
  floors: number[];
  caps: { waiting: MovePoint; serving: MovePoint; done: MovePoint };
};

/**
 * Where everything stands, in board units. Each point is where feet touch the floor.
 * @param layout Screen orientation.
 * @returns Geometry of the stage.
 */
function geometry(layout: SignageLayout): LaneGeometry {
  if (layout === 'portrait') {
    return {
      slots: 6,
      slot: (i) => ({ x: 45 - i * 7.2, y: 46 }),
      stations: [{ x: 11, y: 22 }, { x: 27, y: 22 }, { x: 43, y: 22 }],
      stationWidth: 12,
      serveDx: -4.4,
      scale: 1.4,
      entry: { x: -6, y: 46 },
      exitX: 59,
      floors: [22, 46],
      caps: { waiting: { x: 2, y: 29 }, serving: { x: 2, y: 1.2 }, done: { x: 33, y: 1.2 } },
    };
  }
  return {
    slots: 6,
    slot: (i) => ({ x: 49 - i * 7.4, y: 19.6 }),
    stations: [{ x: 64, y: 19.6 }, { x: 77, y: 19.6 }, { x: 90, y: 19.6 }],
    stationWidth: 11.5,
    serveDx: -4.6,
    scale: 1.45,
    entry: { x: -6, y: 19.6 },
    exitX: 103,
    floors: [19.6],
    caps: { waiting: { x: 2.2, y: 1.2 }, serving: { x: 57, y: 1.2 }, done: { x: 80, y: 1.2 } },
  };
}

const SHIRTS = ['var(--sg-accent)', 'var(--sg-highlight)', 'var(--sg-deep)', 'var(--sg-muted)'];

/**
 * Shirt colour for a queue, fixed by its id so a figure keeps its colour while it moves.
 * @param id Booking id.
 * @returns CSS colour.
 */
function shirtFor(id: string): string {
  let sum = 0;
  for (let i = 0; i < id.length; i += 1) sum = (sum + id.charCodeAt(i)) % 997;
  return SHIRTS[sum % SHIRTS.length];
}

type Placed = { id: string; person: SignagePerson; at: MovePoint; hero: boolean };

/**
 * Lane: the queue as people. Customers stand in line, walk to their service point
 * when called, and walk out when they are done.
 *
 * Movement is read from the difference between two polls, so it plays when the
 * board receives new data, not at the instant the staff act. A called queue with
 * no service point appears in the panel above but has no figure on the stage.
 */
export function LaneTemplate({ data, config, mode, labels, clock, dateLabel }: SignageTemplateProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const uid = useArtId();
  const gsap = useSceneMotion(mode);
  const g = geometry(config.layout);
  const artKey = sceneArtFor(config.theme);

  const stations = buildStations(data, g.stations.length);
  const line = waitingLine(data);
  const heroId = data.now_calling[0]?.id ?? '';

  const placed: Placed[] = [];
  stations.forEach((s, i) => {
    if (s.occupant) placed.push({ id: s.occupant.id, person: s.occupant, at: { x: g.stations[i].x + g.serveDx, y: g.stations[i].y }, hero: s.occupant.id === heroId });
  });
  line.slice(0, g.slots).forEach((p, i) => placed.push({ id: p.id, person: p, at: g.slot(i), hero: false }));

  const departed = useDeparted(placed).map((d) => ({ ...d, at: { x: g.exitX, y: d.at.y }, hero: false }));
  const leaving = new Set(departed.map((d) => d.id));
  const everyone = [...placed, ...departed.filter((d) => !placed.some((p) => p.id === d.id))];

  const positions: Record<string, MovePoint> = {};
  for (const t of everyone) positions[t.id] = t.at;

  useMoveTo(rootRef, gsap, positions, { enterFrom: g.entry, leaving });
  useAmbientMotion(rootRef, gsap, `${config.theme}-${config.layout}`);
  useEntrance(rootRef, gsap, heroId, playCallEntrance);

  const hidden = Math.max(0, data.totals.waiting - Math.min(line.length, g.slots));
  const tail = g.slot(Math.max(0, Math.min(line.length, g.slots) - 1));
  const em = (units: number, fontEm: number) => `${units / fontEm}em`;

  return (
    <SceneShell data={data} config={config} clock={clock} dateLabel={dateLabel} bodyClassName={styles.lane} rootRef={rootRef}>
      <HeroPanel data={data} config={config} labels={labels} uid={uid} variant={config.layout === 'portrait' ? 'tall' : 'wide'} />
      <div className={styles.stage}>
        {g.floors.map((y) => (
          <div key={y} className={styles.floorLine} style={{ top: `${y}em` }} />
        ))}
        <div className={styles.door} style={{ top: `${g.entry.y - 7}em` }} />
        <div className={styles.cap} style={{ left: em(g.caps.waiting.x, 1.6), top: em(g.caps.waiting.y, 1.6) }}>
          {labels.next_queue}
          <b>{data.totals.waiting}</b>
        </div>
        <div className={styles.cap} style={{ left: em(g.caps.serving.x, 1.6), top: em(g.caps.serving.y, 1.6) }}>
          {labels.serving}
          <b>{data.totals.calling}</b>
        </div>
        <div className={styles.cap} style={{ left: em(g.caps.done.x, 1.6), top: em(g.caps.done.y, 1.6) }}>
          {labels.served_today}
          <b>{data.totals.served_today}</b>
        </div>

        {stations.map((s, i) => (
          <div key={s.name} className={`${styles.station} ${s.occupant ? styles.stationBusy : ''}`} style={{ left: `${g.stations[i].x}em`, top: `${g.stations[i].y}em` }}>
            <div className={styles.stationIn} style={{ width: `${g.stationWidth}em` }}>
              <StationArt artKey={artKey} />
            </div>
            <div className={styles.stationName}>
              {s.name}
              <em>{s.occupant ? s.occupant.queue_number : labels.free}</em>
            </div>
          </div>
        ))}

        {hidden > 0 ? (
          <span className={styles.more} style={{ left: em(tail.x - 4.2 * g.scale, 1.6), top: em(tail.y - 3 * g.scale, 1.6) }}>
            +{hidden}
          </span>
        ) : null}

        {everyone.map((t) => (
          <div key={t.id} data-move-id={t.id} className={`${styles.token} ${t.hero ? styles.tokenHero : ''}`} style={{ left: `${t.at.x}em`, top: `${t.at.y}em`, opacity: leaving.has(t.id) && !gsap ? 0 : undefined }}>
            <div className={styles.tokenIn} style={{ fontSize: `${g.scale}em` }}>
              <span className={styles.tag}>{t.person.queue_number}</span>
              <div className={styles.figure} data-walk>
                <span className={styles.figHead} />
                <span className={styles.figBody} style={{ background: shirtFor(t.id) }} />
                <span className={styles.figLegs}>
                  <i />
                  <i />
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </SceneShell>
  );
}
