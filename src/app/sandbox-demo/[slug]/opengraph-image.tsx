import { ImageResponse } from 'next/og';
import { SCENARIO_LIST, scenarioBySlug } from '@/lib/demo/scenarios';
import { loadKanit, siteHost } from '@/lib/seo/og-fonts';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'ทดลองระบบจองคิวผ่าน LINE ตามประเภทธุรกิจ';

/** One card per business type, built at build time. */
export function generateStaticParams() {
  return SCENARIO_LIST.map((s) => ({ slug: s.slug }));
}

/**
 * Social card for one sandbox page: business label, the page H1 and the first
 * services, so a link shared in LINE / Facebook shows which business it is for.
 * Emoji are left out on purpose — Satori would fetch them from a CDN at build time.
 */
export default async function SandboxOgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const scenario = scenarioBySlug(slug);
  const fonts = await loadKanit();
  const host = siteHost();
  const heading = scenario?.seo.h1 ?? 'ทดลองระบบจองคิวผ่าน LINE';
  const label = scenario?.label ?? 'ทุกประเภทธุรกิจ';
  const services = scenario?.services.slice(0, 3).map((s) => s.name) ?? [];

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
          fontFamily: 'Kanit',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: '#12a862', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 700 }}>
            Q
          </div>
          <div style={{ fontSize: 30, color: '#0f172a', fontWeight: 700 }}>QueueBooking LINE</div>
          <div style={{ marginLeft: 'auto', display: 'flex', padding: '8px 20px', borderRadius: 999, background: '#12a862', color: '#fff', fontSize: 24, fontWeight: 700 }}>
            ทดลองฟรี ไม่ต้องสมัคร
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontSize: 30, color: '#0a7043', fontWeight: 700 }}>{label}</div>
          <div style={{ fontSize: 60, color: '#111827', fontWeight: 700, lineHeight: 1.2 }}>{heading}</div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {services.map((name) => (
              <div key={name} style={{ display: 'flex', padding: '6px 16px', borderRadius: 12, border: '2px solid #cfe8d8', background: '#fff', color: '#334155', fontSize: 24 }}>
                {name}
              </div>
            ))}
          </div>
        </div>

        <div style={{ fontSize: 20, color: '#64748b' }}>{`${host}/sandbox-demo`}</div>
      </div>
    ),
    { ...size, fonts },
  );
}
