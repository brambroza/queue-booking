'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { bookingConfirmFlex } from '@/lib/line/messages';
import type { FlexNode } from '@/lib/line/flex-canvas';
import { FlexBubbleCanvas } from './flex-bubble-canvas';
import { LandingIcon, type LandingIconName } from './landing-icons';
import { demoShop } from './landing-content';
import styles from './landing.module.css';

type Step = 1 | 2 | 3;

const TABS: Array<{ step: Step; label: string }> = [
  { step: 1, label: '1 แตะ Rich Menu' },
  { step: 2, label: '2 เลือกเวลา' },
  { step: 3, label: '3 ได้การ์ดยืนยัน' },
];

const MENU: Array<{ label: string; icon: LandingIconName; primary?: boolean; goTo?: Step }> = [
  { label: 'จองคิว', icon: 'calendar', primary: true, goTo: 2 },
  { label: 'คิวของฉัน', icon: 'list', goTo: 3 },
  { label: 'เวลาทำการ', icon: 'clock' },
  { label: 'บริการ & ราคา', icon: 'tag' },
  { label: 'แผนที่', icon: 'pin' },
  { label: 'ติดต่อร้าน', icon: 'chat' },
];

const DAYS = [
  { label: 'จ.', day: '10' },
  { label: 'อ.', day: '11', on: true },
  { label: 'พ.', day: '12' },
  { label: 'พฤ.', day: '13' },
  { label: 'ศ.', day: '14' },
];

const SLOTS: Array<{ time: string; left: number; cap: number }> = [
  { time: '09:00', left: 2, cap: 3 },
  { time: '09:30', left: 0, cap: 3 },
  { time: '10:00', left: 1, cap: 3 },
  { time: '10:30', left: 3, cap: 3 },
  { time: '11:00', left: 3, cap: 3 },
  { time: '11:30', left: 0, cap: 3 },
  { time: '13:00', left: 2, cap: 3 },
  { time: '13:30', left: 3, cap: 3 },
  { time: '14:00', left: 1, cap: 3 },
];

/**
 * Three-tap simulation of a customer booking inside LINE: Rich Menu → time
 * slots (full ones disabled, like the real LIFF) → the real confirmation Flex
 * card. Runs entirely in the page; nothing is sent anywhere.
 */
export function LandingLineDemo() {
  const [step, setStep] = useState<Step>(1);
  const [time, setTime] = useState<string>(demoShop.time);

  const bubble = useMemo(
    () =>
      bookingConfirmFlex({
        shopName: demoShop.shopName,
        queueNumber: demoShop.queueNumber,
        branch: demoShop.branch,
        service: demoShop.service,
        date: demoShop.dateLabel,
        time,
        liffUrl: 'https://liff.line.me/example',
        bookingId: 'example',
      }).contents as FlexNode,
    [time],
  );

  return (
    <div className={styles.demo} aria-label="ทดลองจองคิวแบบลูกค้า">
      <div className={styles.demoTabs} role="tablist" aria-label="ขั้นตอน">
        {TABS.map((tab) => (
          <button
            key={tab.step}
            type="button"
            role="tab"
            aria-selected={step === tab.step}
            className={`${styles.demoTab} ${step === tab.step ? styles.demoTabActive : ''}`}
            onClick={() => setStep(tab.step)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className={styles.demoPhone}>
        <div className={styles.demoScreen}>
          <div className={styles.demoBar}>
            <i aria-hidden="true">Q</i>
            {demoShop.shopName}
            <small>LINE OA</small>
          </div>

          {step === 1 && (
            <>
              <div className={styles.demoChat}>
                <div className={styles.bubble}>สวัสดีค่ะ จองคิวตรวจได้จากเมนูด้านล่างเลยนะคะ</div>
                <div className={styles.hint}>แตะปุ่ม “จองคิว” ในเมนู</div>
              </div>
              <div className={styles.richMenu}>
                <div className={styles.richMenuBar}>เมนู ▴</div>
                <div className={styles.richMenuCells}>
                  {MENU.map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      className={`${styles.richMenuCell} ${item.primary ? styles.richMenuCellPrimary : ''}`}
                      onClick={() => item.goTo && setStep(item.goTo)}
                      aria-disabled={!item.goTo}
                    >
                      <LandingIcon name={item.icon} size={18} />
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <div className={styles.liff}>
              <div className={styles.liffHead}>
                <span>{demoShop.service} · 30 นาที</span>
                <small>500 บาท</small>
              </div>
              <div className={styles.days}>
                {DAYS.map((d) => (
                  <span key={d.day} className={`${styles.day} ${d.on ? styles.dayOn : ''}`}>
                    {d.label}
                    <b>{d.day}</b>
                  </span>
                ))}
              </div>
              <div className={styles.slots}>
                {SLOTS.map((s) => {
                  const full = s.left === 0;
                  return (
                    <button
                      key={s.time}
                      type="button"
                      className={`${styles.slot} ${full ? styles.slotFull : ''}`}
                      disabled={full}
                      onClick={() => {
                        setTime(s.time);
                        setStep(3);
                      }}
                    >
                      {s.time}
                      <small>{full ? `เต็ม ${s.cap}/${s.cap}` : `ว่าง ${s.left}`}</small>
                    </button>
                  );
                })}
              </div>
              <div className={`${styles.hint} ${styles.hintSoft}`}>แตะช่องที่ว่างเพื่อจอง</div>
              <div className={styles.liffFoot}>
                <span>{demoShop.branch}</span>
                <span>ช่องเต็มกดไม่ได้</span>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className={styles.demoChat}>
              <div className={`${styles.bubble} ${styles.bubbleMine}`}>
                จองคิว {demoShop.service} {demoShop.dateLabel} {time}
              </div>
              <FlexBubbleCanvas bubble={bubble} width={220} alt={`การ์ดยืนยันจองคิว ${demoShop.queueNumber} เวลา ${time}`} />
              <div className={styles.hint}>ร้านเห็นคิวนี้บนกระดานทันที</div>
              <button type="button" className={`${styles.btn} ${styles.btnGhost} ${styles.demoSmallButton}`} onClick={() => setStep(1)}>
                จองอีกครั้ง
              </button>
            </div>
          )}
        </div>
      </div>

      <p className={styles.demoNote}>
        ตัวอย่างจำลองในหน้าเว็บ ไม่ส่งข้อความจริง · <Link href="/sandbox-demo">ลองครบทุกขั้นใน 21 ธุรกิจ</Link>
      </p>
    </div>
  );
}
