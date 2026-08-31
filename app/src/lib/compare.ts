/**
 * The comparison selection.
 *
 * Until now the comparator could only be filled by hand-editing its URL, which
 * made a genuinely useful page unreachable from the shop. The selection now
 * lives in a cookie, for one reason: the bar that shows it is rendered on the
 * server, and the server has to be able to read the selection to render it.
 * `localStorage` would have forced the bar to appear after hydration — a visible
 * jump on every page, and a state the suite could only observe by polling.
 *
 * The cookie is deliberately *not* HttpOnly. It carries no authority: a slug
 * list is what the visitor themselves chose to look at, the page it feeds is
 * public, and the toggle that writes it is a client component. Marking it
 * HttpOnly would mean a round trip to the server for a preference that never
 * leaves the browsing session.
 *
 * Every function here is pure and total. A cookie is attacker-controlled text —
 * hand-edited, stale, or truncated — so parsing never throws and never trusts
 * what it reads: unknown slugs are dropped later, when the products are looked
 * up, and the length cap is applied here.
 */

export const COMPARE_COOKIE = 'fretline_compare';

/**
 * Three, not "as many as you like". A comparison table is read across, and a
 * fourth column pushes the first off a laptop screen — at which point the page
 * stops comparing anything.
 */
export const MAX_COMPARED = 3;

/** A slug is `[a-z0-9-]`; anything else in the cookie is not one of ours. */
const SLUG_PATTERN = /^[a-z0-9-]{1,120}$/;

export function parseCompareCookie(raw: string | undefined | null): string[] {
  if (!raw) return [];

  const seen = new Set<string>();
  for (const candidate of raw.split(',')) {
    const slug = candidate.trim();
    // Deduplicated on the way in rather than on the way out: the same product
    // added twice must not consume two of the three slots.
    if (SLUG_PATTERN.test(slug)) seen.add(slug);
    if (seen.size === MAX_COMPARED) break;
  }

  return [...seen];
}

export function serialiseCompareCookie(slugs: string[]): string {
  return slugs.slice(0, MAX_COMPARED).join(',');
}

/**
 * Adds a product, or removes it when it is already selected.
 *
 * The same control does both, so a visitor who mis-clicks undoes it in the same
 * place. A full selection ignores the addition rather than evicting the oldest:
 * silently dropping something the visitor picked is worse than refusing, and the
 * caller can say so.
 */
export function toggleCompared(slugs: string[], slug: string): string[] {
  if (slugs.includes(slug)) return slugs.filter((entry) => entry !== slug);
  if (slugs.length >= MAX_COMPARED) return slugs;
  return [...slugs, slug];
}

/** Whether `toggleCompared` would refuse the addition — the caller explains why. */
export function isCompareFull(slugs: string[], slug: string): boolean {
  return !slugs.includes(slug) && slugs.length >= MAX_COMPARED;
}
