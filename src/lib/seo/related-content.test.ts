import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SOLUTION,
  postsForSolution,
  relatedPosts,
  relatedScore,
  solutionForPost,
  type LinkablePost,
} from './related-content';

const post = (slug: string, keywords: string[], category = 'Guide', publishedAt = '2026-10-01'): LinkablePost => ({
  slug,
  title: slug,
  category,
  keywords,
  publishedAt,
});

const clinic = post('clinic-appointment-booking-via-line', ['ระบบนัดหมายคลินิก', 'จองคิวคลินิก'], 'Clinic', '2026-10-13');
const dental = post('dental-clinic-reminder', ['ระบบนัดหมายคลินิกทันตกรรม', 'จองคิวคลินิก'], 'Clinic', '2026-11-01');
const table = post('line-table-booking', ['ระบบจองโต๊ะ', 'ร้านอาหาร'], 'Restaurant', '2026-05-21');
const barber = post('barber-shop-flow', ['ระบบจองคิวร้านตัดผม'], 'Barber', '2026-05-16');
const generic = post('what-is-line-queue-booking-system', ['ระบบจองคิวผ่าน line'], 'Guide', '2026-10-01');
const all = [clinic, dental, table, barber, generic];

describe('solutionForPost', () => {
  it('maps a clinic post to the clinic page', () => {
    expect(solutionForPost(clinic).path).toBe('/solutions/clinic-booking-system');
  });
  it('maps a table booking post to the restaurant page', () => {
    expect(solutionForPost(table).path).toBe('/solutions/restaurant-booking-system');
  });
  it('falls back to the default page', () => {
    expect(solutionForPost(generic)).toBe(DEFAULT_SOLUTION);
  });
});

describe('relatedScore', () => {
  it('scores shared keyword + category + topic', () => {
    expect(relatedScore(clinic, dental)).toBeGreaterThanOrEqual(7);
  });
  it('is zero for unrelated posts', () => {
    expect(relatedScore(clinic, barber)).toBe(0);
  });
});

describe('relatedPosts', () => {
  it('never returns the current post and puts the closest first', () => {
    const r = relatedPosts(clinic, all, 3);
    expect(r).not.toContain(clinic);
    expect(r[0]).toBe(dental);
    expect(r).toHaveLength(3);
  });
  it('pads with newest posts when few relate', () => {
    const r = relatedPosts(barber, all, 2);
    expect(r).toHaveLength(2);
    expect(r[0]).toBe(dental);
  });
  it('returns nothing for limit 0', () => {
    expect(relatedPosts(clinic, all, 0)).toEqual([]);
  });
});

describe('postsForSolution', () => {
  it('lists matching posts newest first', () => {
    expect(postsForSolution('/solutions/clinic-booking-system', all)).toEqual([dental, clinic]);
  });
  it('returns empty for an unknown path', () => {
    expect(postsForSolution('/nope', all)).toEqual([]);
  });
});
