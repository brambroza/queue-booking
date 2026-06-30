function formatTHB(amount: number) {
  return amount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Flex Message ส่ง QR PromptPay ให้ลูกค้าสแกนชำระ */
export function qrPaymentFlex(payload: {
  shopName: string;
  queueNumber: string;
  service: string;
  branch: string;
  date: string;
  time: string;
  amountTHB: number;
  qrImageUrl: string;
  expiresAt?: string | null;
  isTest?: boolean;
}) {
  const expireLabel = payload.expiresAt
    ? new Date(payload.expiresAt).toLocaleString('th-TH', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok',
      })
    : null;

  const noteContents: Array<Record<string, unknown>> = [
    { type: 'text', text: 'สแกน QR Code ด้วยแอปธนาคารเพื่อชำระเงิน', size: 'xs', color: '#4b5563', wrap: true },
  ];
  if (expireLabel) {
    noteContents.push({ type: 'text', text: `หมดอายุ: ${expireLabel}`, size: 'xs', color: '#ef4444', margin: 'sm', wrap: true });
  }
  if (payload.isTest) {
    noteContents.push({ type: 'text', text: '[TEST MODE]', size: 'xs', color: '#6b7280', margin: 'sm' });
  }

  return {
    type: 'flex',
    altText: `ชำระเงิน ${formatTHB(payload.amountTHB)} บาท – คิว ${payload.queueNumber}`,
    contents: {
      type: 'bubble',
      size: 'kilo',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#1d4ed8',
        paddingAll: '16px',
        contents: [
          { type: 'text', text: payload.shopName, color: '#ffffff99', size: 'xs' },
          { type: 'text', text: 'ชำระเงิน', color: '#ffffff', weight: 'bold', size: 'xl', margin: 'sm' },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          {
            type: 'box',
            layout: 'vertical',
            spacing: 'xs',
            contents: [
              { type: 'text', text: `คิว ${payload.queueNumber}`, weight: 'bold', size: 'lg', color: '#111827' },
              { type: 'text', text: `บริการ: ${payload.service}`, size: 'sm', color: '#374151', wrap: true },
              { type: 'text', text: `สาขา: ${payload.branch}`, size: 'sm', color: '#374151', wrap: true },
              { type: 'text', text: `${payload.date}  ${payload.time}`, size: 'sm', color: '#374151' },
            ],
          },
          {
            type: 'separator',
          },
          {
            type: 'box',
            layout: 'vertical',
            alignItems: 'center',
            contents: [
              {
                type: 'text',
                text: `${formatTHB(payload.amountTHB)} บาท`,
                weight: 'bold',
                size: 'xxl',
                color: '#1d4ed8',
              },
              {
                type: 'image',
                url: payload.qrImageUrl,
                size: 'full',
                aspectMode: 'fit',
                aspectRatio: '1:1',
                margin: 'md',
              },
            ],
          },
          {
            type: 'box',
            layout: 'vertical',
            backgroundColor: '#f0fdf4',
            cornerRadius: '8px',
            paddingAll: '10px',
            contents: noteContents,
          },
        ],
      },
    },
  };
}

/** Flex Message ใบเสร็จรับเงิน หลังชำระสำเร็จ */
export function paymentReceiptFlex(payload: {
  shopName: string;
  queueNumber: string;
  service: string;
  branch: string;
  date: string;
  time: string;
  amountTHB: number;
  receiptRef: string;
  paidAt: string;
}) {
  const paidLabel = new Date(payload.paidAt).toLocaleString('th-TH', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok',
  });

  return {
    type: 'flex',
    altText: `ใบเสร็จรับเงิน ${formatTHB(payload.amountTHB)} บาท – คิว ${payload.queueNumber}`,
    contents: {
      type: 'bubble',
      size: 'kilo',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#16a34a',
        paddingAll: '16px',
        contents: [
          { type: 'text', text: payload.shopName, color: '#ffffff99', size: 'xs' },
          { type: 'text', text: 'ชำระเงินสำเร็จ', color: '#ffffff', weight: 'bold', size: 'xl', margin: 'sm' },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            justifyContent: 'center',
            contents: [
              { type: 'text', text: '✓', size: 'xxl', color: '#16a34a', weight: 'bold' },
            ],
          },
          { type: 'separator', margin: 'md' },
          {
            type: 'box',
            layout: 'vertical',
            margin: 'md',
            spacing: 'sm',
            contents: [
              { type: 'text', text: 'ใบเสร็จรับเงิน', weight: 'bold', size: 'md', color: '#111827' },
              { type: 'text', text: `เลขที่: ${payload.receiptRef}`, size: 'xs', color: '#6b7280' },
              { type: 'text', text: `ชำระเมื่อ: ${paidLabel}`, size: 'xs', color: '#6b7280', margin: 'sm' },
            ],
          },
          { type: 'separator' },
          {
            type: 'box',
            layout: 'vertical',
            margin: 'md',
            spacing: 'xs',
            contents: [
              { type: 'text', text: `คิว: ${payload.queueNumber}`, size: 'sm', color: '#374151', weight: 'bold' },
              { type: 'text', text: `บริการ: ${payload.service}`, size: 'sm', color: '#374151', wrap: true },
              { type: 'text', text: `สาขา: ${payload.branch}`, size: 'sm', color: '#374151', wrap: true },
              { type: 'text', text: `วันที่: ${payload.date}  ${payload.time}`, size: 'sm', color: '#374151' },
            ],
          },
          { type: 'separator' },
          {
            type: 'box',
            layout: 'horizontal',
            margin: 'md',
            justifyContent: 'space-between',
            contents: [
              { type: 'text', text: 'ยอดชำระ', weight: 'bold', size: 'md', color: '#111827' },
              { type: 'text', text: `${formatTHB(payload.amountTHB)} บาท`, weight: 'bold', size: 'md', color: '#16a34a' },
            ],
          },
          {
            type: 'box',
            layout: 'vertical',
            margin: 'lg',
            backgroundColor: '#f0fdf4',
            cornerRadius: '8px',
            paddingAll: '10px',
            contents: [
              { type: 'text', text: 'ขอบคุณที่ใช้บริการค่ะ', size: 'xs', color: '#15803d', align: 'center' },
            ],
          },
        ],
      },
    },
  };
}
