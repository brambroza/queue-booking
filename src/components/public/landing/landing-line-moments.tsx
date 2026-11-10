'use client';

import { useMemo } from 'react';
import { bookingCalledFlex, bookingConfirmFlex, bookingReminderFlex } from '@/lib/line/messages';
import { followupThanksFlex } from '@/lib/line/messages-automation';
import type { FlexNode } from '@/lib/line/flex-canvas';
import { FlexBubbleCanvas } from './flex-bubble-canvas';
import { demoShop } from './landing-content';
import styles from './landing.module.css';

const CARD_WIDTH = 236;

type Moment = { when: string; note: string; alt: string; bubble: FlexNode };

/** Builds the four customer-side cards with the production Flex builders. */
function buildMoments(): Moment[] {
  const base = {
    shopName: demoShop.shopName,
    queueNumber: demoShop.queueNumber,
    branch: demoShop.branch,
    service: demoShop.service,
  };
  // Example links: the real cards carry the shop's own LIFF URL.
  const liffUrl = 'https://liff.line.me/example';
  return [
    {
      when: 'ทันทีที่จอง',
      note: 'การ์ดยืนยันพร้อมปุ่มยกเลิกเอง ไม่ต้องทักถามร้าน',
      alt: 'การ์ด LINE จองคิวสำเร็จ เลขคิว A007 พร้อมปุ่มดูคิวของฉันและยกเลิกคิว',
      bubble: bookingConfirmFlex({ ...base, date: demoShop.dateLabel, time: demoShop.time, liffUrl, bookingId: 'example' }).contents as FlexNode,
    },
    {
      when: 'ก่อนถึงคิว 30 นาที',
      note: 'ตั้งเวลาเตือนได้ 15 นาที ถึง 1 วัน ลดลูกค้าเบี้ยวนัด',
      alt: 'การ์ด LINE เตือนคิว อีก 30 นาทีถึงคิว A007',
      bubble: bookingReminderFlex({ ...base, date: demoShop.dateLabel, time: demoShop.time, minutesBefore: 30, liffUrl, bookingId: 'example' }).contents as FlexNode,
    },
    {
      when: 'เมื่อร้านกดเรียกคิว',
      note: 'พนักงานกดปุ่มเดียวบนกระดานคิว ลูกค้ารอที่ไหนก็ได้',
      alt: 'การ์ด LINE ถึงคิวของคุณแล้ว เชิญที่ห้องตรวจ 2',
      bubble: bookingCalledFlex({ ...base, assignedTo: demoShop.room, assignedLabel: 'ห้อง', callCount: 1, liffUrl }).contents as FlexNode,
    },
    {
      when: 'หลังใช้บริการ',
      note: 'ข้อความขอบคุณพร้อมปุ่มรีวิว และชวนลูกค้าเก่ากลับมาเมื่อถึงรอบ',
      alt: 'การ์ด LINE ขอบคุณที่มาใช้บริการ พร้อมปุ่มให้คะแนนร้านและจองครั้งถัดไป',
      bubble: followupThanksFlex({ shopName: demoShop.shopName, service: demoShop.service, reviewUrl: 'https://g.page/example', bookUrl: liffUrl }).contents as FlexNode,
    },
  ];
}

/** "ลูกค้าเห็นอะไรใน LINE": four moments of a queue, each the real Flex card. */
export function LandingLineMoments() {
  const moments = useMemo(buildMoments, []);
  return (
    <div className={styles.moments}>
      {moments.map((m) => (
        <article key={m.when} className={styles.moment}>
          <span className={styles.momentWhen}>{m.when}</span>
          <FlexBubbleCanvas bubble={m.bubble} width={CARD_WIDTH} alt={m.alt} />
          <p>{m.note}</p>
        </article>
      ))}
    </div>
  );
}
