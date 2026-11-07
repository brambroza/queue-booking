import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://queuebooking.com';
  return {
    // One group per user agent: two `*` groups are merged by Google but not by every crawler.
    rules: [{ userAgent: '*', allow: '/', disallow: ['/portal/', '/api/'] }],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}

