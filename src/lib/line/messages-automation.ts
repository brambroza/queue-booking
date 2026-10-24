/**
 * Flex messages for customer automations (post-service follow-up, win-back).
 * Kept apart from `messages.ts`, which holds the transactional booking cards.
 */

type FlexButton = Record<string, unknown>;

/** Cuts a label LINE would reject (button labels max 40 chars; we keep it shorter). */
function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/**
 * Thank-you card sent a while after a completed queue.
 *
 * @param payload.reviewUrl - Shop's review link (https), adds "ให้คะแนนร้าน".
 * @param payload.bookUrl - LIFF booking link, adds "จองครั้งถัดไป".
 */
export function followupThanksFlex(payload: {
  shopName: string;
  service: string;
  customerName?: string | null;
  reviewUrl?: string | null;
  bookUrl?: string | null;
}) {
  const greeting = payload.customerName ? `ขอบคุณคุณ${clip(payload.customerName, 30)}` : 'ขอบคุณที่มาใช้บริการ';
  const buttons: FlexButton[] = [];
  if (payload.reviewUrl) {
    buttons.push({
      type: 'button',
      style: 'primary',
      color: '#12a862',
      height: 'sm',
      action: { type: 'uri', label: 'ให้คะแนนร้าน', uri: payload.reviewUrl },
    });
  }
  if (payload.bookUrl) {
    buttons.push({
      type: 'button',
      style: payload.reviewUrl ? 'secondary' : 'primary',
      ...(payload.reviewUrl ? {} : { color: '#12a862' }),
      height: 'sm',
      action: { type: 'uri', label: 'จองครั้งถัดไป', uri: payload.bookUrl },
    });
  }

  return {
    type: 'flex',
    altText: `${greeting} — ${payload.shopName}`,
    contents: {
      type: 'bubble',
      size: 'kilo',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#12a862',
        paddingAll: '16px',
        contents: [
          { type: 'text', text: payload.shopName, color: '#ffffffcc', size: 'xs' },
          { type: 'text', text: greeting, color: '#ffffff', weight: 'bold', size: 'xl', margin: 'sm', wrap: true },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          { type: 'text', text: `บริการ: ${payload.service}`, size: 'sm', color: '#374151', wrap: true },
          {
            type: 'text',
            text: payload.reviewUrl
              ? 'หวังว่าจะประทับใจนะคะ ช่วยให้คะแนนร้านสักนิด เป็นกำลังใจให้ร้านได้มากเลยค่ะ'
              : 'หวังว่าจะประทับใจนะคะ แล้วพบกันใหม่ค่ะ',
            size: 'sm',
            color: '#111827',
            wrap: true,
            margin: 'md',
          },
        ],
      },
      ...(buttons.length > 0 ? { footer: { type: 'box', layout: 'vertical', spacing: 'sm', contents: buttons } } : {}),
    },
  };
}

/**
 * "We miss you" card for a regular customer who is past their usual return date.
 *
 * @param payload.daysSince - Days since the last completed visit.
 * @param payload.lastService - Service of that visit, used as the hook.
 */
export function winbackFlex(payload: {
  shopName: string;
  customerName?: string | null;
  lastService?: string | null;
  daysSince: number;
  bookUrl?: string | null;
}) {
  const who = payload.customerName ? `คุณ${clip(payload.customerName, 30)}` : 'คุณลูกค้า';
  const since = payload.daysSince >= 60 ? `${Math.round(payload.daysSince / 30)} เดือน` : `${payload.daysSince} วัน`;
  const hook = payload.lastService
    ? `ครั้งล่าสุดคุณมาใช้บริการ "${clip(payload.lastService, 40)}" เมื่อ ${since} ก่อน ถึงเวลาดูแลตัวเองอีกครั้งแล้วหรือยังคะ`
    : `ไม่ได้เจอกัน ${since} แล้ว ถึงเวลาแวะมาอีกครั้งหรือยังคะ`;

  return {
    type: 'flex',
    altText: `${payload.shopName} คิดถึง${who} — จองคิวได้เลย`,
    contents: {
      type: 'bubble',
      size: 'kilo',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#12a862',
        paddingAll: '16px',
        contents: [
          { type: 'text', text: payload.shopName, color: '#ffffffcc', size: 'xs' },
          { type: 'text', text: `คิดถึง${who}`, color: '#ffffff', weight: 'bold', size: 'xl', margin: 'sm', wrap: true },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [{ type: 'text', text: hook, size: 'sm', color: '#111827', wrap: true }],
      },
      ...(payload.bookUrl
        ? {
            footer: {
              type: 'box',
              layout: 'vertical',
              spacing: 'sm',
              contents: [
                {
                  type: 'button',
                  style: 'primary',
                  color: '#12a862',
                  height: 'sm',
                  action: { type: 'uri', label: 'จองคิวเลย', uri: payload.bookUrl },
                },
              ],
            },
          }
        : {}),
    },
  };
}
