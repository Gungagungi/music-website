/**
 * Constants shared between server modules and client components.
 *
 * `lib/cart.ts` pulls in the in-memory database, so a client component cannot
 * import from it — these values live on their own to keep the bundle clean.
 */
export const MAX_QUANTITY_PER_LINE = 10;
export const FREE_SHIPPING_THRESHOLD_CENTS = 19900;
