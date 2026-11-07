/**
 * Internal links between blog posts and `/solutions/*` pages.
 *
 * Search Console showed most blog posts with no impressions: the only path to
 * them was the `/blog` index. These helpers pick related posts and the matching
 * solution page so every post and solution page links to its neighbours.
 * Pure functions, no data imports, so they are unit-tested on plain fixtures.
 */

/** The subset of a blog post these helpers read. */
export type LinkablePost = {
  slug: string;
  title: string;
  category: string;
  keywords: string[];
  publishedAt: string;
};

/** A solution landing page and the words that mark a post as being about it. */
export type SolutionTopic = {
  path: string;
  label: string;
  /** Lower-case fragments matched against a post's slug and keywords. */
  match: string[];
};

/** Order matters: the first topic that matches a post wins. */
export const SOLUTION_TOPICS: SolutionTopic[] = [
  { path: '/solutions/clinic-booking-system', label: 'ระบบนัดหมายคลินิกผ่าน LINE', match: ['clinic', 'คลินิก', 'คนไข้', 'ทันตกรรม'] },
  { path: '/solutions/restaurant-booking-system', label: 'ระบบจองโต๊ะร้านอาหารผ่าน LINE', match: ['restaurant', 'table-booking', 'จองโต๊ะ', 'ร้านอาหาร'] },
  { path: '/solutions/buffet-booking-system', label: 'ระบบจองร้านบุฟเฟ่ต์ผ่าน LINE', match: ['buffet', 'บุฟเฟ่ต์', 'ชาบู'] },
  { path: '/solutions/barbershop-booking-system', label: 'ระบบจองคิวร้านตัดผมผ่าน LINE', match: ['barber', 'ตัดผม', 'ร้านทำผม'] },
  { path: '/solutions/nail-salon-booking-system', label: 'ระบบจองร้านทำเล็บผ่าน LINE', match: ['nail', 'ทำเล็บ', 'เสริมสวย'] },
  { path: '/solutions/badminton-court-booking-system', label: 'ระบบจองสนามแบดผ่าน LINE', match: ['badminton', 'สนามแบด'] },
  { path: '/solutions/tennis-court-booking-system', label: 'ระบบจองสนามเทนนิสผ่าน LINE', match: ['tennis', 'เทนนิส'] },
  { path: '/solutions/bb-gun-field-booking-system', label: 'ระบบจองสนาม BB Gun ผ่าน LINE', match: ['bb-gun', 'bb gun'] },
  { path: '/solutions/fitness-class-booking-system', label: 'ระบบจองคลาสฟิตเนสและโยคะผ่าน LINE', match: ['fitness', 'yoga', 'โยคะ', 'ฟิตเนส'] },
  { path: '/solutions/meeting-room-booking-system', label: 'ระบบจองห้องประชุมผ่าน LINE', match: ['meeting-room', 'coworking', 'ห้องประชุม'] },
  { path: '/features/promptpay-payment', label: 'รับชำระเงิน PromptPay อัตโนมัติผ่าน LINE', match: ['promptpay', 'slip', 'payment', 'สลิป', 'ชำระเงิน'] },
  { path: '/solutions/appointment-booking-system', label: 'ระบบนัดหมายออนไลน์ผ่าน LINE OA', match: ['appointment', 'นัดหมาย', 'no-show', 'reminder'] },
];

/** Fallback when no topic matches: the general LINE booking page. */
export const DEFAULT_SOLUTION: SolutionTopic = {
  path: '/solutions/appointment-booking-system',
  label: 'ระบบนัดหมายออนไลน์ผ่าน LINE OA',
  match: [],
};

/**
 * Text a post is matched on: slug plus keywords, lower-cased.
 * @param post Post to read.
 * @returns One lower-case string.
 */
function haystack(post: LinkablePost): string {
  return [post.slug, ...post.keywords].join(' ').toLowerCase();
}

/**
 * Does this topic describe the post?
 * @param topic Solution topic.
 * @param post Blog post.
 * @returns true when any match fragment appears in the post's slug or keywords.
 */
export function topicMatchesPost(topic: SolutionTopic, post: LinkablePost): boolean {
  const text = haystack(post);
  return topic.match.some((m) => text.includes(m.toLowerCase()));
}

/**
 * The solution page a post should link to.
 * @param post Blog post.
 * @returns First matching topic, else `DEFAULT_SOLUTION`.
 */
export function solutionForPost(post: LinkablePost): SolutionTopic {
  return SOLUTION_TOPICS.find((t) => topicMatchesPost(t, post)) ?? DEFAULT_SOLUTION;
}

/**
 * Relatedness score between two posts.
 * Shared keyword = 3, same category = 2, same solution topic = 2, shared slug word = 1.
 * @param a First post.
 * @param b Second post.
 * @returns Non-negative score; 0 = unrelated.
 */
export function relatedScore(a: LinkablePost, b: LinkablePost): number {
  const kwA = new Set(a.keywords.map((k) => k.toLowerCase()));
  let score = 0;
  for (const k of b.keywords) if (kwA.has(k.toLowerCase())) score += 3;
  if (a.category && a.category === b.category) score += 2;
  if (solutionForPost(a).path === solutionForPost(b).path) score += 2;
  const ignore = new Set(['via', 'line', 'booking', 'queue', 'and', 'the', 'for']);
  const wordsA = new Set(a.slug.split('-').filter((w) => w.length > 2 && !ignore.has(w)));
  for (const w of new Set(b.slug.split('-'))) if (wordsA.has(w)) score += 1;
  return score;
}

/**
 * Posts to show under "บทความที่เกี่ยวข้อง".
 * @param current Post being read.
 * @param posts All posts.
 * @param limit Max posts returned.
 * @returns Highest score first, newer first on ties; never the current post. Pads with the newest posts when too few relate.
 */
export function relatedPosts<T extends LinkablePost>(current: LinkablePost, posts: T[], limit = 3): T[] {
  if (limit <= 0) return [];
  const others = posts.filter((p) => p.slug !== current.slug);
  const byNewest = (x: T, y: T) => y.publishedAt.localeCompare(x.publishedAt);
  const scored = others
    .map((p) => ({ p, s: relatedScore(current, p) }))
    .filter((x) => x.s > 0)
    .sort((x, y) => y.s - x.s || byNewest(x.p, y.p))
    .map((x) => x.p);
  const picked = scored.slice(0, limit);
  if (picked.length < limit) {
    for (const p of [...others].sort(byNewest)) {
      if (picked.length >= limit) break;
      if (!picked.includes(p)) picked.push(p);
    }
  }
  return picked;
}

/**
 * Posts to list on a solution page.
 * @param path Solution page path, e.g. `/solutions/clinic-booking-system`.
 * @param posts All posts.
 * @param limit Max posts returned.
 * @returns Posts whose topic is this page, newest first; empty for an unknown path.
 */
export function postsForSolution<T extends LinkablePost>(path: string, posts: T[], limit = 4): T[] {
  const topic = SOLUTION_TOPICS.find((t) => t.path === path);
  if (!topic || limit <= 0) return [];
  return posts
    .filter((p) => topicMatchesPost(topic, p))
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, limit);
}
