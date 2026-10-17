/**
 * Recently viewed products.
 *
 * A cookie, for the same reason as the comparison selection: the block is
 * rendered on the server, so the server has to be able to read the list. It is
 * *not* attached to an account, and that is the difference from favourites —
 * this is browsing history, not something the visitor asked to keep. Storing it
 * against an identity would turn an incidental convenience into a record we
 * would then owe them a way to delete.
 *
 * Pure and total, like the comparison cookie: this is attacker-controlled text.
 */

export const RECENTLY_VIEWED_COOKIE = 'fretline_vus';

/**
 * Six. Enough to find the guitar you looked at four pages ago, few enough that
 * the row does not become a second catalogue nobody scrolls.
 */
export const MAX_RECENTLY_VIEWED = 6;

const SLUG_PATTERN = /^[a-z0-9-]{1,120}$/;

export function parseRecentlyViewed(raw: string | undefined | null): string[] {
  if (!raw) return [];

  const seen = new Set<string>();
  for (const candidate of raw.split(',')) {
    const slug = candidate.trim();
    if (SLUG_PATTERN.test(slug)) seen.add(slug);
    if (seen.size === MAX_RECENTLY_VIEWED) break;
  }

  return [...seen];
}

/**
 * Records a visit: the product goes to the front, and a re-visit moves it there
 * rather than adding a duplicate.
 *
 * The oldest entry *is* evicted here, unlike the comparison selection which
 * refuses a fourth product. The two are different promises: a comparison is a
 * deliberate choice the visitor would notice losing, a history is incidental and
 * silently forgetting its tail is exactly what it is for.
 */
export function recordVisit(slugs: string[], slug: string): string[] {
  return [slug, ...slugs.filter((entry) => entry !== slug)].slice(0, MAX_RECENTLY_VIEWED);
}

export function serialiseRecentlyViewed(slugs: string[]): string {
  return slugs.slice(0, MAX_RECENTLY_VIEWED).join(',');
}
