import { expect, test } from '@/fixtures/api-fixtures';
import { cartSchema, purgeSummarySchema } from '@/api/schemas';
import { EPHEMERAL_CART_ID, PRODUCTS, RETENTION } from '@/data/seed';
import { TAGS, covers, testCase } from '@/utils/tags';
import type { ApiClient } from '@/api/ApiClient';

/**
 * Cart retention.
 *
 * The kind of business rule most shops deploy and never test: it runs at night,
 * it deletes rows, and nobody notices it is wrong until the rows are gone. It is
 * also the kind that cannot be tested by reading the thresholds back — an
 * assertion derived from the same constant agrees with a broken policy exactly
 * as readily as with a correct one. So each spec ages a real cart to just inside
 * or just outside a window and asks whether the real purge kept it.
 *
 * Assertions are on **one cart's survival**, never on the counts the purge
 * reports. The purge is global, several workers run in parallel, and those
 * counts include whatever the rest of the suite happened to leave behind. A
 * given cart's fate, on the other hand, is decided by the rule alone.
 */

const HOURS_PER_DAY = 24;

/** Creates a cart holding one item, and returns its id. */
async function cartWithItem(client: ApiClient): Promise<string> {
  const cart = await client.addToCartAndTrack({ sku: PRODUCTS.retention.sku, quantity: 1 });
  return cart.id;
}

/** True when the cart is still readable — a purged one comes back as the nil uuid. */
async function survives(client: ApiClient, cartId: string): Promise<boolean> {
  const cart = await client.expectOk(await client.withCart(cartId).cart(), cartSchema);
  return cart.id === cartId;
}

test.describe('API — rétention des paniers', () => {
  test(
    'consulter un panier inexistant n’en crée aucun',
    {
      tag: [TAGS.regression, TAGS.critical],
      annotation: [
        testCase('TC-420', 'Le panier n’est matérialisé qu’au premier ajout'),
        covers('REQ-DATA-10'),
      ],
    },
    async ({ api }) => {
      // A crawler never returns a cookie, so every one of its requests used to
      // mint a row. Those empty carts would have been the overwhelming majority
      // of the table, and purging them afterwards is mopping around an open tap.
      for (let visit = 0; visit < 5; visit += 1) {
        const cart = await api.expectOk(await api.cart(), cartSchema);
        expect(cart.id, 'aucune ligne écrite pour une simple lecture').toBe(EPHEMERAL_CART_ID);
        expect(cart.items).toHaveLength(0);
      }

      // Validating a coupon prices the cart, which is a read too.
      await api.validateCoupon('BIENVENUE10');
      const after = await api.expectOk(await api.cart(), cartSchema);
      expect(after.id).toBe(EPHEMERAL_CART_ID);
    },
  );

  test(
    'un panier vide survit à quelques heures et pas à la journée',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-421', 'Rétention des paniers vides'), covers('REQ-DATA-11')],
    },
    async ({ api, otherApi }) => {
      // Emptied rather than never-filled: a cart only exists once something has
      // been put in it, so this is the only way to obtain an empty row at all.
      const jeune = await cartWithItem(api);
      await api.clearCart();
      const vieux = await cartWithItem(otherApi);
      await otherApi.clearCart();

      await api.seed({
        carts: [
          { id: jeune, ageHours: RETENTION.emptyCartHours - 2 },
          { id: vieux, ageHours: RETENTION.emptyCartHours + 1 },
        ],
      });

      await api.expectOk(await api.purgeCarts(), purgeSummarySchema);

      expect(await survives(api, jeune), 'une session de navigation plausible est préservée').toBe(
        true,
      );
      expect(await survives(otherApi, vieux), 'passé la journée, un panier vide ne dit rien').toBe(
        false,
      );
    },
  );

  test(
    'un panier invité garni suit la durée de vie de son cookie',
    {
      tag: [TAGS.regression, TAGS.critical],
      annotation: [testCase('TC-422', 'Rétention des paniers invités'), covers('REQ-DATA-12')],
    },
    async ({ api, otherApi }) => {
      const dansLaFenetre = await cartWithItem(api);
      const horsFenetre = await cartWithItem(otherApi);

      await api.seed({
        carts: [
          { id: dansLaFenetre, ageHours: (RETENTION.guestCartDays - 1) * HOURS_PER_DAY },
          { id: horsFenetre, ageHours: (RETENTION.guestCartDays + 1) * HOURS_PER_DAY },
        ],
      });

      await api.expectOk(await api.purgeCarts(), purgeSummarySchema);

      // The window is the cookie's lifetime, not a number picked in a meeting:
      // past it, no one on earth can address the row again.
      expect(await survives(api, dansLaFenetre)).toBe(true);
      expect(await survives(otherApi, horsFenetre)).toBe(false);
    },
  );

  test(
    'un panier rattaché à un compte échappe à la fenêtre invité',
    {
      tag: [TAGS.regression, TAGS.critical],
      annotation: [testCase('TC-423', 'Exemption des paniers d’un compte'), covers('REQ-DATA-13')],
    },
    async ({ authedApi }) => {
      const cartId = await cartWithItem(authedApi);

      await authedApi.seed({
        carts: [{ id: cartId, ageHours: (RETENTION.guestCartDays + 1) * HOURS_PER_DAY }],
      });
      await authedApi.expectOk(await authedApi.purgeCarts(), purgeSummarySchema);

      // The assertion that carries the policy: same age as the guest cart the
      // previous spec sees deleted, and it stays. « Votre panier vous attend »
      // is a feature, and the row is reachable at every future sign-in.
      expect(await survives(authedApi, cartId), 'un compte rend le panier atteignable').toBe(true);
    },
  );

  test(
    'un panier d’un compte dormant depuis plus d’un an est purgé',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-424', 'Balayage des comptes dormants'), covers('REQ-DATA-14')],
    },
    async ({ authedApi }) => {
      const cartId = await cartWithItem(authedApi);

      await authedApi.seed({
        carts: [{ id: cartId, ageHours: (RETENTION.accountCartDays + 35) * HOURS_PER_DAY }],
      });
      await authedApi.expectOk(await authedApi.purgeCarts(), purgeSummarySchema);

      // The exemption above is not unlimited. This last sweep is a
      // data-protection measure, which is why it is measured in a year rather
      // than in days.
      expect(await survives(authedApi, cartId)).toBe(false);
    },
  );
});
