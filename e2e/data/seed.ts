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

/**
 * Stored reviews of `PRODUCTS.reviewed`, level by level. The suite asserts the
 * histogram against these counts, so a seed change that forgets the suite fails
 * loudly instead of quietly weakening the assertions.
 */
export const REVIEWS = {
  product: 'fender-player-ii-stratocaster-mn',
  pageSize: 5,
  stored: 10,
  histogram: { 1: 1, 2: 1, 3: 2, 4: 3, 5: 3 },
  verified: 7,
  /** Most recent review — the first row under the default `recents` sort. */
  newest: 'Hugo L.',
  oldest: 'Inès F.',
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
  /**
   * The only product seeded with enough reviews to page through and to draw a
   * histogram covering all five levels. Its aggregates (`rating`,
   * `reviewCount`) still describe a longer history than the ten stored reviews
   * — that gap is deliberate, and `REVIEWS` records what is actually stored.
   */
  reviewed: {
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
  /**
   * Reserved for the concurrency specs, which force the stock to an exact value
   * and then assert on what two simultaneous orders did to it.
   *
   * One product per spec, and used by nothing else. `fullyParallel` means two
   * specs arranging the stock of the same product would each see the other's
   * number, and the failure would read as a race in the application — the very
   * thing these specs exist to detect. A dedicated product is what keeps a red
   * run meaningful.
   */
  lastUnitRace: {
    slug: 'gibson-sg-standard',
    sku: 'GIB-SGSTAN-004',
    brand: 'Gibson',
  },
  /** Reserved for the "never below zero" spec. */
  stockFloor: {
    slug: 'epiphone-les-paul-classic',
    sku: 'EPI-LESPAU-005',
    brand: 'Epiphone',
  },
  /**
   * Reserved for the restock-alert specs, which force the stock to zero and
   * back. Two products rather than one: subscribing and sweeping are different
   * assertions, and a spec that sweeps would fire the other spec's alert.
   */
  alertTarget: {
    slug: 'jackson-pro-series-soloist-sl2',
    sku: 'JAC-PROSER-012',
    brand: 'Jackson',
  },
  restockTarget: {
    slug: 'gretsch-g2622-streamliner',
    sku: 'GRE-G2622S-013',
    brand: 'Gretsch',
  },
  /**
   * The one alert spec that needs an *available* product. It cannot share
   * `alertTarget`, which the other alert specs hold at zero: `fullyParallel`
   * would let the two arrangements interleave, and the failure would read as a
   * broken rule rather than as two specs fighting over one shelf.
   */
  alertAvailableTarget: {
    slug: 'ibanez-az2402-prestige',
    sku: 'IBA-AZ2402-008',
    brand: 'Ibanez',
  },
  /**
   * Reserved for the low-stock display spec, which forces the stock to an exact
   * value and asserts the wording derived from it. Any other spec ordering this
   * product would move the number under the assertion.
   */
  lowStock: {
    slug: 'taylor-214ce-plus',
    sku: 'TAY-214CEP-015',
    brand: 'Taylor',
  },
  /**
   * Reserved for the UI review-publishing specs, and used by nothing else.
   * Publishing moves the product's average and its stored review count, both of
   * which those specs assert on — a second spot writing here would make them
   * fail for a reason unrelated to the behaviour under test.
   */
  reviewTarget: {
    slug: 'martin-guitar-d-28-standard',
    sku: 'MAR-D28STA-014',
    brand: 'Martin Guitar',
  },
  /** Reserved for the checkout atomicity spec — the line that must survive. */
  atomicityIntact: {
    slug: 'squier-classic-vibe-60s-stratocaster',
    sku: 'SQU-CLASSI-006',
    brand: 'Squier',
  },
  /** Reserved for the checkout atomicity spec — the line that must fail. */
  atomicityBlocked: {
    slug: 'prs-se-custom-24',
    sku: 'PRS-SECUST-009',
    brand: 'PRS',
  },
  /** Reserved for the retention specs, which need an item that never runs out. */
  retention: {
    slug: 'esp-ltd-ec-256',
    sku: 'ESP-LTDEC2-011',
    brand: 'ESP',
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
  { slug: PRODUCTS.retention.slug, quantity: 999 },
] as const;

export const CATEGORIES = {
  electricGuitars: { slug: 'guitares-electriques', label: 'Guitares électriques' },
  effectPedals: { slug: 'pedales-effets', label: 'Pédales d’effets' },
  strings: { slug: 'cordes', label: 'Cordes' },
} as const;

export const CATALOG_TOTAL_PRODUCTS = 73;

/**
 * The identity of a cart that was never stored.
 *
 * `GET /api/cart` hands this back to a visitor who has no cart, instead of
 * writing a row for every request that so much as looks at one. It is therefore
 * also how a spec recognises a cart the retention policy has deleted: the id it
 * held comes back as the nil uuid. Mirrors EPHEMERAL_CART_ID in
 * `app/src/lib/repositories/carts.ts`.
 */
export const EPHEMERAL_CART_ID = '00000000-0000-0000-0000-000000000000';

/**
 * Cart retention windows. Mirrors `app/src/lib/retention.ts`.
 *
 * The specs age a cart to just inside and just outside each window rather than
 * reading the threshold and asserting on it — an assertion derived from the same
 * constant would agree with a broken policy as readily as with a correct one.
 */
export const RETENTION = {
  emptyCartHours: 24,
  guestCartDays: 30,
  accountCartDays: 365,
} as const;

/** Business rules the suite asserts against. Mirrors `app/src/lib/money.ts`. */
/**
 * Availability thresholds, mirroring `app/src/lib/availability.ts`. Below the
 * threshold the page names how many units are left, at or above it it says
 * nothing more than "En stock".
 */
export const AVAILABILITY = {
  lowStockThreshold: 3,
  shippingInStock: 'Expédié sous 24 h',
  shippingOutOfStock: 'Réapprovisionnement sous 3 à 4 semaines',
} as const;

export const RULES = {
  vatRate: 0.2,
  freeShippingThresholdCents: 19900,
  flatShippingCents: 990,
  maxQuantityPerLine: 10,
  defaultPageSize: 12,
} as const;
