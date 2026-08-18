/**
 * Cart retention policy.
 *
 * Guest carts accumulate: every checkout leaves one behind, and every visitor who
 * adds something and never returns leaves one too. Deleting them on a single
 * age threshold would be wrong, because the rows are not all worth the same.
 *
 * The guiding rule is that **retention follows reachability**. A guest cart is
 * addressed only by the `fretline_cart` cookie; once that cookie has expired, no
 * one on earth can reach the row again, so it is rubbish by construction rather
 * than by a number someone picked in a meeting. That is why the guest window is
 * tied to the cookie's lifetime and not chosen independently — changing one
 * without the other is what creates carts that exist but cannot be opened, or
 * cookies pointing at rows that were already deleted.
 */

/** Mirrors CART_COOKIE_MAX_AGE in lib/cart-session.ts. */
export const GUEST_CART_RETENTION_DAYS = 30;

/**
 * Carts that never held an item — created by a bot, or by a visitor who opened
 * the cart page and left. They carry no information, so they only need to
 * outlive a plausible browsing session.
 */
export const EMPTY_CART_RETENTION_HOURS = 24;

/**
 * Carts belonging to an account are deliberately **not** subject to the rules
 * above: "your cart is still here" is a feature, and the row stays reachable at
 * every future sign-in. The long window here is a data-protection measure for
 * dormant accounts, not housekeeping.
 */
export const ACCOUNT_CART_RETENTION_DAYS = 365;

/**
 * Rows deleted per statement.
 *
 * A single unbounded DELETE over a large table holds its locks for the whole
 * scan and writes one enormous WAL record. Batching keeps each transaction short
 * enough that ordinary traffic never queues behind the purge.
 */
export const PURGE_BATCH_SIZE = 5_000;
