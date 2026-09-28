'use client';

import { useRef } from 'react';
import { isIdle, waitingLine } from '@/lib/signage/scene';
import type { SignageTemplateProps } from '../template-props';
import { HeroPanel, PosterQr, SceneArt, SceneQr, SceneShell, useArtId } from '../scenes/scene-parts';
import { playCallEntrance, useAmbientMotion, useEntrance, useSceneMotion } from '../scenes/use-scene-motion';
import styles from '../scenes/scenes.module.css';

/**
 * Invite: a queue board that turns into a shop-front poster when nobody is
 * waiting, and back into a queue board as soon as someone books.
 *
 * The poster needs the booking QR, so it only shows one when "show QR" is on and
 * the shop has a LIFF id. It does not list free time slots: the signage feed does
 * not carry them.
 */
export function InviteTemplate({ data, config, mode, labels, clock, dateLabel }: SignageTemplateProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const uid = useArtId();
  const gsap = useSceneMotion(mode);
  const idle = isIdle(data);
  const portrait = config.layout === 'portrait';

  useAmbientMotion(rootRef, gsap, `${config.theme}-${idle ? 'poster' : 'queue'}`);
  useEntrance(rootRef, gsap, idle ? 'poster' : 'queue', (g, root) => {
    g.from(root.querySelectorAll('[data-swap]'), { y: '1.4em', opacity: 0, duration: 0.7, stagger: 0.12, ease: 'power2.out' });
  });
  useEntrance(rootRef, gsap, data.now_calling[0]?.id ?? '', playCallEntrance);

  if (idle) {
    const [line1, ...rest] = labels.invite_title.split(' ');
    return (
      <SceneShell data={data} config={config} clock={clock} dateLabel={dateLabel} bodyClassName={data.qr_url ? styles.invite : styles.inviteSolo} rootRef={rootRef}>
        <section className={styles.poster} data-swap>
          <SceneArt config={config} uid={uid} viewBox="330 0 290 360" fit="xMaxYMid meet" />
          <span className={styles.kicker}>{labels.invite_kicker}</span>
          <h4>
            {line1}
            <br />
            {rest.join(' ')}
          </h4>
          <ol className={styles.steps}>
            {labels.invite_steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>
        {data.qr_url ? (
          <aside className={styles.scan} data-swap>
            <PosterQr url={data.qr_url} mode={mode} alt={labels.scan_to_book} />
            <b>{labels.scan_to_book}</b>
            <small>{labels.invite_no_app}</small>
          </aside>
        ) : null}
      </SceneShell>
    );
  }

  const next = waitingLine(data).slice(0, portrait ? 3 : 4);
  return (
    <SceneShell data={data} config={config} clock={clock} dateLabel={dateLabel} bodyClassName={styles.inviteQueue} rootRef={rootRef}>
      <div data-swap style={{ display: 'grid', minHeight: 0 }}>
        <HeroPanel data={data} config={config} labels={labels} uid={uid} variant="tall" />
      </div>
      <div className={styles.list} data-swap>
        <span className={styles.label}>{labels.next_queue}</span>
        {next.length === 0 ? <div className={styles.empty}>{labels.empty_next}</div> : null}
        {next.map((p) => (
          <div key={p.id} className={styles.item}>
            <b>{p.queue_number}</b>
            <div>
              {p.customer_name ? <b>{p.customer_name}</b> : null}
              <small>{[p.service_name, p.resource_name].filter(Boolean).join(' · ')}</small>
            </div>
            <time>{p.start_time ?? ''}</time>
          </div>
        ))}
        <div className={styles.listFoot}>
          <SceneQr data={data} mode={mode} labels={labels} />
        </div>
      </div>
    </SceneShell>
  );
}
