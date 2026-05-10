import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://queue-booking-line.vercel.app';
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
      },
      {
        userAgent: '*',
        disallow: ['/portal/', '/api/'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}

