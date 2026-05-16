import { ImageResponse } from 'next/og';

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = 'image/png';

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, #eaf6ee 0%, #ffffff 55%, #f6f7f9 100%)',
          padding: '56px',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: '#73c088',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 28,
              fontWeight: 700,
            }}
          >
            Q
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 36, color: '#0f172a', fontWeight: 700 }}>QueueBooking LINE</div>
            <div style={{ fontSize: 20, color: '#475569' }}>| ระบบจองคิวผ่าน LINE OA | QueueBooking LINE</div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 56, color: '#111827', fontWeight: 700, lineHeight: 1.2 }}>
            ระบบจองคิวผ่าน LINE OA
          </div>
          <div style={{ fontSize: 28, color: '#334155' }}>
            Manage branches, services, bookings, and reports in one dashboard
          </div>
        </div>

        <div style={{ fontSize: 20, color: '#64748b' }}>queue-booking-line.vercel.app</div>
      </div>
    ),
    {
      ...size,
    },
  );
}

