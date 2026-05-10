import type { MetadataRoute } from 'next';
import { useCases } from '@/components/public/content';
import { blogPosts } from '@/components/public/blog-content';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://queue-booking-line.vercel.app';
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/pricing`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${base}/contact`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/use-cases`, lastModified: now, changeFrequency: 'weekly', priority: 0.85 },
    { url: `${base}/blog`, lastModified: now, changeFrequency: 'weekly', priority: 0.85 },
    { url: `${base}/login`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/register`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
  ];

  const useCasePages: MetadataRoute.Sitemap = useCases.map((u) => ({
    url: `${base}/use-cases/${u.slug}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.75,
  }));

  const blogPages: MetadataRoute.Sitemap = blogPosts.map((p) => ({
    url: `${base}/blog/${p.slug}`,
    lastModified: now,
    changeFrequency: 'monthly',
    priority: 0.72,
  }));

  return [...staticPages, ...useCasePages, ...blogPages];
}
