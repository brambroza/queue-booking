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
