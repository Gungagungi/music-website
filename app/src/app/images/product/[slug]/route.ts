import { getProductBySlug } from '@/lib/catalog';
import type { CategorySlug } from '@/lib/types';

/**
 * Product artwork is generated as SVG rather than shipped as bitmaps.
 *
 * Three reasons, all of them QA reasons: no third-party image host means the
 * suite runs offline, no photography means no licensing question in a public
 * portfolio, and vector output rendered from a deterministic seed means visual
 * regression baselines are stable across machines and browsers. The drawings
 * contain no text, because font rasterisation is the usual culprit behind
 * "screenshot differs by 0.2%" failures.
 */

const CATEGORY_PALETTE: Record<CategorySlug, [string, string, string]> = {
  'guitares-electriques': ['#1d2b3a', '#2f4a63', '#f0a04b'],
  'guitares-acoustiques': ['#2a2118', '#4a3a26', '#d9a566'],
  'guitares-classiques': ['#241f2e', '#3f3550', '#c9a6e0'],
  'basses-electriques': ['#131f2b', '#26414f', '#5ec8c0'],
  'amplis-guitare': ['#1b1b1b', '#333333', '#e2703a'],
  'amplis-basse': ['#161d1a', '#2c3a33', '#7bc47f'],
  'pedales-effets': ['#1a1524', '#332a45', '#ff7ab6'],
  cordes: ['#1e1e24', '#3a3a45', '#c0c6cf'],
  accessoires: ['#1c2226', '#343f46', '#9ad0e3'],
};

function hashHue(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) % 360;
  }
  return hash;
}

function silhouette(category: CategorySlug, accent: string): string {
  const body = (fill: string) => `fill="${fill}" stroke="rgba(255,255,255,0.18)" stroke-width="3"`;

  switch (category) {
    case 'guitares-electriques':
    case 'basses-electriques':
      return `
        <rect x="192" y="60" width="16" height="180" rx="4" ${body('#8a6a45')} />
        <path d="M176 46 h48 a14 14 0 0 1 14 14 v20 a14 14 0 0 1 -14 14 h-48 a14 14 0 0 1 -14 -14 v-20 a14 14 0 0 1 14 -14 z" ${body('#6f5537')} />
        <path d="M200 230 c-22 0 -34 -8 -52 -8 c-24 0 -40 18 -40 42 c0 16 8 26 12 38 c4 12 0 22 4 32 c8 20 34 34 76 34 s68 -14 76 -34 c4 -10 0 -20 4 -32 c4 -12 12 -22 12 -38 c0 -24 -16 -42 -40 -42 c-18 0 -30 8 -52 8 z" ${body(accent)} />
        <rect x="168" y="256" width="64" height="13" rx="3" fill="rgba(0,0,0,0.45)" />
        <rect x="168" y="284" width="64" height="13" rx="3" fill="rgba(0,0,0,0.45)" />
        <rect x="172" y="312" width="56" height="10" rx="2" fill="rgba(0,0,0,0.55)" />
        <circle cx="244" cy="330" r="6" fill="rgba(0,0,0,0.5)" />
        <circle cx="262" cy="312" r="6" fill="rgba(0,0,0,0.5)" />`;

    case 'guitares-acoustiques':
    case 'guitares-classiques':
      return `
        <rect x="192" y="48" width="16" height="150" rx="4" ${body('#8a6a45')} />
        <path d="M200 196 c-40 0 -68 22 -68 54 c0 22 14 34 14 46 c0 16 -18 22 -18 44 c0 30 30 52 72 52 s72 -22 72 -52 c0 -22 -18 -28 -18 -44 c0 -12 14 -24 14 -46 c0 -32 -28 -54 -68 -54 z" ${body(accent)} />
        <circle cx="200" cy="286" r="26" fill="rgba(0,0,0,0.55)" />
        <circle cx="200" cy="286" r="30" fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="3" />
        <rect x="176" y="336" width="48" height="12" rx="3" fill="rgba(0,0,0,0.45)" />`;

    case 'amplis-guitare':
    case 'amplis-basse':
      return `
        <rect x="76" y="96" width="248" height="216" rx="14" ${body(accent)} />
        <rect x="96" y="150" width="208" height="142" rx="8" fill="rgba(0,0,0,0.55)" />
        <circle cx="200" cy="221" r="52" fill="none" stroke="rgba(255,255,255,0.16)" stroke-width="4" />
        <circle cx="200" cy="221" r="22" fill="rgba(255,255,255,0.1)" />
        <rect x="96" y="112" width="208" height="26" rx="6" fill="rgba(0,0,0,0.4)" />
        <circle cx="122" cy="125" r="7" fill="rgba(255,255,255,0.35)" />
        <circle cx="150" cy="125" r="7" fill="rgba(255,255,255,0.35)" />
        <circle cx="178" cy="125" r="7" fill="rgba(255,255,255,0.35)" />`;

    case 'pedales-effets':
      return `
        <rect x="112" y="96" width="176" height="216" rx="16" ${body(accent)} />
        <rect x="132" y="120" width="136" height="70" rx="10" fill="rgba(0,0,0,0.4)" />
        <circle cx="164" cy="155" r="20" fill="rgba(255,255,255,0.18)" stroke="rgba(255,255,255,0.3)" stroke-width="3" />
        <circle cx="236" cy="155" r="20" fill="rgba(255,255,255,0.18)" stroke="rgba(255,255,255,0.3)" stroke-width="3" />
        <rect x="140" y="234" width="120" height="52" rx="12" fill="rgba(0,0,0,0.5)" />
        <circle cx="200" cy="260" r="16" fill="rgba(255,255,255,0.25)" />`;

    case 'cordes':
      return `
        <rect x="96" y="112" width="208" height="176" rx="12" ${body(accent)} />
        <circle cx="200" cy="200" r="66" fill="none" stroke="rgba(0,0,0,0.5)" stroke-width="10" />
        <circle cx="200" cy="200" r="50" fill="none" stroke="rgba(255,255,255,0.28)" stroke-width="6" />
        <circle cx="200" cy="200" r="34" fill="none" stroke="rgba(0,0,0,0.45)" stroke-width="6" />
        <circle cx="200" cy="200" r="18" fill="rgba(255,255,255,0.14)" />`;

    case 'accessoires':
    default:
      return `
        <path d="M200 92 l92 54 v108 l-92 54 l-92 -54 v-108 z" ${body(accent)} />
        <path d="M200 140 l50 30 v60 l-50 30 l-50 -30 v-60 z" fill="rgba(0,0,0,0.45)" />
        <circle cx="200" cy="200" r="22" fill="rgba(255,255,255,0.2)" />`;
  }
}

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  const category: CategorySlug = product?.category ?? 'accessoires';
  const [from, to, defaultAccent] = CATEGORY_PALETTE[category];
  // A brand-derived hue keeps two guitars from the same category visually
  // distinct in a grid, while staying reproducible.
  const accent = product
    ? `hsl(${hashHue(product.brand)} 62% 58%)`
    : defaultAccent;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400" role="img">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${from}" />
      <stop offset="100%" stop-color="${to}" />
    </linearGradient>
  </defs>
  <rect width="400" height="400" fill="url(#bg)" />
  <circle cx="330" cy="72" r="120" fill="rgba(255,255,255,0.05)" />
  ${silhouette(category, accent)}
</svg>`;

  return new Response(svg, {
    headers: {
      'content-type': 'image/svg+xml; charset=utf-8',
      'cache-control': 'public, max-age=31536000, immutable',
    },
  });
}
