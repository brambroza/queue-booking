import { redirect } from 'next/navigation';
import { toThaiPath } from '@/lib/i18n/public-routes';

type Props = {
  params: Promise<{ rest: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * `/en/*` paths without an English page (e.g. `/en/register`, `/en/login`,
 * old links or a cached language switch) go to the Thai page instead of 404.
 * Routes that do exist under `/en` take precedence over this catch-all.
 */
export default async function EnFallbackPage({ params, searchParams }: Props) {
  const { rest } = await params;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    for (const v of Array.isArray(value) ? value : value === undefined ? [] : [value]) query.append(key, v);
  }
  const path = toThaiPath(`/en/${rest.map(encodeURIComponent).join('/')}`);
  const qs = query.toString();
  redirect(qs ? `${path}?${qs}` : path);
}
