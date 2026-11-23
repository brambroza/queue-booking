import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ENGLISH_PAGES_INDEXABLE } from '@/lib/seo/english-pages';

/** Every `/en` page inherits this: noindex while English pages are switched off for search. */
export const metadata: Metadata = {
  robots: ENGLISH_PAGES_INDEXABLE ? undefined : { index: false, follow: true },
};

/**
 * Pass-through layout for the English pages; exists only to carry the robots rule.
 * @param props.children The English page.
 */
export default function EnglishLayout({ children }: { children: ReactNode }) {
  return children;
}
