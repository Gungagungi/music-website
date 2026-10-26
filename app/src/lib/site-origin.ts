/**
 * The origin a visitor used to reach the shop, for the few documents that must
 * spell out absolute URLs: the sitemap and the `Sitemap:` line of robots.txt.
 *
 * Read from the request rather than from configuration because the application
 * has no notion of its own domain — `FRETLINE_DOMAIN` belongs to Caddy — and
 * because pre-production serves the very same build under another name. A
 * domain baked in at build time would have the pre-production sitemap list
 * production URLs, and the suite, which runs against both, assert the wrong one.
 *
 * Same rule as `requeteChiffree()` in proxy.ts: Caddy terminates TLS and talks
 * plain HTTP to the container, so the scheme the browser saw only survives in
 * `x-forwarded-proto`. Without a proxy in front, the hop is the visit, and
 * `next start` never speaks TLS.
 */
export function publicOrigin(headers: Headers): string {
  const forwardedProto = firstValue(headers.get('x-forwarded-proto'));
  const protocol = forwardedProto === 'https' ? 'https' : 'http';
  const host = firstValue(headers.get('x-forwarded-host')) ?? headers.get('host') ?? 'localhost';
  // Through `URL` so that a malformed Host fails here instead of being echoed
  // into a document crawlers will follow.
  return new URL(`${protocol}://${host}`).origin;
}

/** First entry of a comma-separated header, as appended by successive proxies. */
function firstValue(value: string | null): string | undefined {
  const first = value?.split(',')[0].trim();
  return first || undefined;
}
