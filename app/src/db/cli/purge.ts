import { runCommand } from '@/db/cli/run';
import { purgeStaleCarts } from '@/lib/repositories/carts';

/**
 * Applies the cart retention policy. Intended to run on a schedule — see
 * lib/retention.ts for the rules and why each window is what it is.
 *
 * A command rather than a timer inside the application on purpose: an in-process
 * job would run once per replica the day the site scales to two containers, and
 * nobody remembers that on that day.
 */
runCommand('purge des paniers', async () => {
  const summary = await purgeStaleCarts();

  console.log(
    `[db] paniers purgés — ${summary.emptyCarts} vides, ` +
      `${summary.guestCarts} invités expirés, ` +
      `${summary.dormantAccountCarts} rattachés à un compte dormant`,
  );
});
