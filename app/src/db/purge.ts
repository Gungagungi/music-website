import { closePool } from '@/db/client';
import { purgeStaleCarts } from '@/lib/repositories/carts';

/**
 * Applies the cart retention policy. Intended to run on a schedule — see
 * lib/retention.ts for the rules and why each window is what it is.
 *
 * It is a separate command rather than a timer inside the application on
 * purpose: an in-process job would run once per replica the day the site scales
 * to two containers, and nobody remembers that on that day.
 */
purgeStaleCarts()
  .then((summary) => {
    console.log(
      `[db] paniers purgés — ${summary.emptyCarts} vides, ` +
        `${summary.guestCarts} invités expirés, ` +
        `${summary.dormantAccountCarts} rattachés à un compte dormant`,
    );
  })
  .catch((error: unknown) => {
    console.error('[db] échec de la purge :', error);
    process.exitCode = 1;
  })
  .finally(closePool);
