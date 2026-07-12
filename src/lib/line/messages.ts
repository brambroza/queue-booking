export function quickReply(items: Array<{ label: string; text: string }>) {
  return {
    items: items.slice(0, 13).map((x) => ({
      type: 'action',
      action: { type: 'message', label: x.label.slice(0, 20), text: x.text },
    })),
  };
}

export function slotMessage(dateLabel: string, slots: string[]) {
  const times = slots.length ? slots.join(', ') : '-';
  return {
    type: 'text',
    text: `วันนี้มีคิวว่างดังนี้ค่ะ\n${times}\n\nต้องการจองเวลาไหนคะ? (${dateLabel})`,
    quickReply: quickReply([
      ...slots.slice(0, 4).map((s) => ({ label: s, text: `จองคิว ${dateLabel} ${s}` })),
      { label: 'ดูวันพรุ่งนี้', text: 'คิวว่างพรุ่งนี้' },
    ]),
  };
}

export function fallbackMessage() {
  return {
    type: 'text',
    text: 'ต้องการทำรายการใดคะ?',
    quickReply: quickReply([
      { label: 'ดูคิวว่าง', text: 'คิวว่างวันนี้' },
      { label: 'จองคิว', text: 'จองคิว' },
      { label: 'เช็คคิวของฉัน', text: 'เช็คคิวของฉัน' },
      { label: 'ติดต่อเจ้าหน้าที่', text: 'ติดต่อเจ้าหน้าที่' },
    ]),
  };
}

export function bookingConfirmMessage(payload: { queueNumber: string; branch: string; service: string; date: string; time: string }) {
  return {
    type: 'text',
    text: `จองคิวสำเร็จค่ะ\nเลขคิว: ${payload.queueNumber}\nสาขา: ${payload.branch}\nบริการ: ${payload.service}\nวันที่: ${payload.date}\nเวลา: ${payload.time}\n\nกรุณามาก่อนเวลาประมาณ 10 นาทีค่ะ`,
  };
}

export function bookingConfirmFlex(payload: {
  shopName: string;
  queueNumber: string;
  branch: string;
  service: string;
  date: string;
  time: string;
  liffUrl?: string;
}) {
  const footerButtons: Array<Record<string, unknown>> = [
    {
      type: 'button',
      style: 'secondary',
      height: 'sm',
      action: { type: 'message', label: 'ดูคิวของฉัน', text: 'เช็คคิวของฉัน' },
    },
    {
      type: 'button',
      style: 'secondary',
      height: 'sm',
      action: { type: 'message', label: 'ยกเลิกคิว', text: 'ยกเลิกคิว' },
    },
  ];
  if (payload.liffUrl) {
    footerButtons.push({
      type: 'button',
      style: 'primary',
      color: '#12a862',
      height: 'sm',
      action: { type: 'uri', label: 'เปิด LIFF อีกครั้ง', uri: payload.liffUrl },
    });
  }

  return {
    type: 'flex',
    altText: `จองคิวสำเร็จ เลขคิว ${payload.queueNumber}`,
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
          { type: 'text', text: 'จองคิวสำเร็จ', color: '#ffffff', weight: 'bold', size: 'xl', margin: 'sm' },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          { type: 'text', text: `เลขคิว ${payload.queueNumber}`, weight: 'bold', size: 'lg', color: '#111827' },
          {
            type: 'box',
            layout: 'vertical',
            margin: 'md',
            spacing: 'sm',
            contents: [
              { type: 'text', text: `สาขา: ${payload.branch}`, size: 'sm', color: '#374151', wrap: true },
              { type: 'text', text: `บริการ: ${payload.service}`, size: 'sm', color: '#374151', wrap: true },
              { type: 'text', text: `วันที่: ${payload.date}`, size: 'sm', color: '#374151' },
              { type: 'text', text: `เวลา: ${payload.time}`, size: 'sm', color: '#374151' },
            ],
          },
          {
            type: 'box',
            layout: 'vertical',
            margin: 'lg',
            backgroundColor: '#f3f4f6',
            cornerRadius: '10px',
            paddingAll: '10px',
            contents: [
              { type: 'text', text: 'กรุณามาก่อนเวลาประมาณ 10 นาที', size: 'xs', color: '#4b5563', wrap: true },
            ],
          },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: footerButtons,
      },
    },
  };
}

export function liffEntryMessage(url: string) {
  return {
    type: 'text',
    text: 'กดลิงก์เพื่อจองคิวผ่านหน้า LIFF ได้เลยค่ะ',
    quickReply: {
      items: [
        {
          type: 'action',
          action: {
            type: 'uri',
            label: 'เปิดหน้าจองคิว',
            uri: url,
          },
        },
      ],
    },
  };
}
