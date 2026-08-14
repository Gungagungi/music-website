/**
 * Mirror of the application's seed data.
 *
 * These values are the *contract* between the app and the suite: as long as
 * `app/src/data/*` seeds them, a spec can rely on them without arranging
 * anything first. Anything a test needs to be unique — a user, an order — is
 * built at runtime instead (see `data/builders`).
 */

export const SEEDED_USERS = {
  /** Has order history after checkout specs run. */
  withOrders: {
    email: 'claire.dubois@fretline.test',
    password: 'Guitare2026!',
    firstName: 'Claire',
    lastName: 'Dubois',
  },
  secondary: {
    email: 'marc.lefevre@fretline.test',
    password: 'BasseLine77!',
    firstName: 'Marc',
    lastName: 'Lefèvre',
  },
  /** Guaranteed to have an empty order history — used for the empty-state spec. */
  withoutOrders: {
    email: 'sans.commande@fretline.test',
    password: 'PanierVide12!',
    firstName: 'Nadia',
    lastName: 'Roux',
  },
} as const;

export const COUPONS = {
  valid: { code: 'BIENVENUE10', minSubtotalCents: 5000, percent: 10 },
  categoryScoped: { code: 'CORDES5', category: 'cordes', amountCents: 500 },
  highMinimum: { code: 'GROSPANIER50', minSubtotalCents: 50000, amountCents: 5000 },
  expired: { code: 'NOEL2020' },
  unknown: { code: 'CE-CODE-N-EXISTE-PAS' },
} as const;

/**
 * Product fixtures picked for a specific property, not at random — a spec that
 * needs an out-of-stock product should say so by name.
 */
export const PRODUCTS = {
  inStock: {
    slug: 'gibson-les-paul-standard-60s',
    sku: 'GIB-LESPAU-003',
    brand: 'Gibson',
    name: 'Les Paul Standard 60s',
    priceCents: 279900,
    category: 'guitares-electriques',
  },
  outOfStock: {
    slug: 'fender-player-ii-stratocaster-mn',
    sku: 'FEN-PLAYER-001',
    brand: 'Fender',
    name: 'Player II Stratocaster MN',
  },
  /** Discounted, hence the price/listPrice pair the promo assertions rely on. */
  cheap: {
    slug: 'boss-ds-1-distortion',
    sku: 'BOS-DS1DIS-050',
    brand: 'Boss',
    name: 'DS-1 Distortion',
    priceCents: 4130,
    category: 'pedales-effets',
  },
  strings: {
    slug: 'ernie-ball-regular-slinky-10-46',
    sku: 'ERN-REGULA-060',
    brand: 'Ernie Ball',
    priceCents: 560,
    category: 'cordes',
  },
  leftHanded: {
    slug: 'harley-benton-st-62-vintage-series',
    sku: 'HAR-ST62VI-010',
    brand: 'Harley Benton',
  },
  /**
   * Reserved for the stock-decrement assertion, and used by nothing else.
   * That test reads the stock level, orders, then reads it again — any other
   * spec ordering the same product in parallel would make it fail for a reason
   * that has nothing to do with the behaviour under test.
   */
  stockTracking: {
    slug: 'ibanez-rg550-genesis',
    sku: 'IBA-RG550G-007',
    brand: 'Ibanez',
  },
} as const;

/**
 * Inventory the suite consumes.
 *
 * Checkout specs decrement stock for real, and every browser project runs them
 * again. Left alone, the shelf empties partway through a full parallel run and
 * unrelated specs start failing with OUT_OF_STOCK — a failure mode that looks
 * like a product bug and is not one. The run-level setup therefore tops these
 * up once, right after the reset.
 */
export const STOCK_TOP_UP = [
  { slug: PRODUCTS.inStock.slug, quantity: 999 },
  { slug: PRODUCTS.cheap.slug, quantity: 999 },
  { slug: PRODUCTS.strings.slug, quantity: 999 },
] as const;

export const CATEGORIES = {
  electricGuitars: { slug: 'guitares-electriques', label: 'Guitares électriques' },
  effectPedals: { slug: 'pedales-effets', label: 'Pédales d’effets' },
  strings: { slug: 'cordes', label: 'Cordes' },
} as const;

export const CATALOG_TOTAL_PRODUCTS = 73;

/** Business rules the suite asserts against. Mirrors `app/src/lib/money.ts`. */
export const RULES = {
  vatRate: 0.2,
  freeShippingThresholdCents: 19900,
  flatShippingCents: 990,
  maxQuantityPerLine: 10,
  defaultPageSize: 12,
} as const;
