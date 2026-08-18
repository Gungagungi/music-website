import { expect, test } from '@/fixtures/api-fixtures';
import { apiErrorSchema, authResponseSchema, productDetailSchema } from '@/api/schemas';
import { OrderBuilder } from '@/data/builders/OrderBuilder';
import { PRODUCTS } from '@/data/seed';
import { uniqueEmail } from '@/utils/unique';
import { TAGS, covers, testCase } from '@/utils/tags';
import type { ApiClient } from '@/api/ApiClient';

/**
 * Concurrency and atomicity.
 *
 * None of this was reachable while the shop kept its data in memory: a single
 * process mutating a plain object has no transactions, no isolation level and no
 * interleaving to get wrong, so these defects could not exist and could not be
 * tested for. They are the reason the store now runs on PostgreSQL — see
 * ADR-005 — and they are the requirements that migration was supposed to buy.
 *
 * Each spec owns a product nobody else touches. Two specs arranging the stock of
 * the same item under `fullyParallel` would read each other's numbers, and the
 * failure would look exactly like the race being hunted.
 */

async function stockOf(client: ApiClient, slug: string): Promise<number> {
  const product = await client.expectOk(await client.product(slug), productDetailSchema);
  return product.stock;
}

test.describe('API — concurrence et atomicité', () => {
  test(
    'deux commandes simultanées sur la dernière unité : une seule aboutit',
    {
      tag: [TAGS.regression, TAGS.critical],
      annotation: [
        testCase('TC-400', 'Course sur la dernière unité en stock'),
        covers('REQ-DATA-01'),
      ],
    },
    async ({ api, otherApi }) => {
      const product = PRODUCTS.lastUnitRace;
      await api.seed({ stock: [{ slug: product.slug, quantity: 1 }] });

      // Both carts are filled first, and both are legitimate at that moment:
      // one unit is available and each is asking for one. The conflict only
      // exists at checkout, which is exactly where a shop discovers it.
      await api.addToCartAndTrack({ sku: product.sku, quantity: 1 });
      await otherApi.addToCartAndTrack({ sku: product.sku, quantity: 1 });

      const [first, second] = await Promise.all([
        api.createOrder(new OrderBuilder().asGuest(uniqueEmail('course-a')).build()),
        otherApi.createOrder(new OrderBuilder().asGuest(uniqueEmail('course-b')).build()),
      ]);

      const statuses = [first.status(), second.status()].sort((a, b) => a - b);
      expect(statuses, 'exactement une commande doit aboutir').toEqual([201, 409]);

      const refused = first.status() === 409 ? first : second;
      const body = await api.expectOk(refused, apiErrorSchema, 409);
      expect(body.error.code).toBe('OUT_OF_STOCK');

      expect(await stockOf(api, product.slug), 'l’étagère est vide, pas négative').toBe(0);
    },
  );

  test(
    'un panier devenu trop grand pour le stock est refusé sans le décrémenter',
    {
      tag: [TAGS.regression, TAGS.critical],
      annotation: [testCase('TC-401', 'Le stock ne passe jamais sous zéro'), covers('REQ-DATA-02')],
    },
    async ({ api }) => {
      const product = PRODUCTS.stockFloor;
      await api.seed({ stock: [{ slug: product.slug, quantity: 5 }] });
      await api.addToCartAndTrack({ sku: product.sku, quantity: 5 });

      // The shelf empties while the cart sits there — the ordinary case, not an
      // exotic one. The check at checkout is the only one that counts.
      await api.seed({ stock: [{ slug: product.slug, quantity: 2 }] });

      const body = await api.expectOk(
        await api.createOrder(new OrderBuilder().asGuest(uniqueEmail('plancher')).build()),
        apiErrorSchema,
        409,
      );
      expect(body.error.code).toBe('OUT_OF_STOCK');

      expect(await stockOf(api, product.slug), 'un refus ne consomme rien').toBe(2);
    },
  );

  test(
    'une commande refusée sur une ligne n’en décrémente aucune autre',
    {
      tag: [TAGS.regression, TAGS.critical],
      annotation: [testCase('TC-402', 'Atomicité du paiement'), covers('REQ-DATA-03')],
    },
    async ({ api }) => {
      const intact = PRODUCTS.atomicityIntact;
      const blocked = PRODUCTS.atomicityBlocked;

      await api.seed({
        stock: [
          { slug: intact.slug, quantity: 10 },
          { slug: blocked.slug, quantity: 1 },
        ],
      });

      await api.addToCartAndTrack({ sku: intact.sku, quantity: 2 });
      await api.addToCart({ sku: blocked.sku, quantity: 1 });

      // Only the second line becomes impossible. A checkout that decremented as
      // it went would take the two units of the first product and *then* fail —
      // the customer pays nothing and the shop has lost stock it never sold.
      await api.seed({ stock: [{ slug: blocked.slug, quantity: 0 }] });

      const body = await api.expectOk(
        await api.createOrder(new OrderBuilder().asGuest(uniqueEmail('atomicite')).build()),
        apiErrorSchema,
        409,
      );
      expect(body.error.code).toBe('OUT_OF_STOCK');

      expect(await stockOf(api, intact.slug), 'la ligne servable n’a pas bougé').toBe(10);
      expect(await stockOf(api, blocked.slug)).toBe(0);
    },
  );

  test(
    'la commande refusée n’a laissé aucune trace',
    {
      tag: [TAGS.regression, TAGS.critical],
      annotation: [testCase('TC-403', 'Aucune commande partielle'), covers('REQ-DATA-03')],
    },
    async ({ authedApi, api }) => {
      const product = PRODUCTS.stockFloor;
      await api.seed({ stock: [{ slug: product.slug, quantity: 1 }] });

      await authedApi.addToCartAndTrack({ sku: product.sku, quantity: 1 });
      await api.seed({ stock: [{ slug: product.slug, quantity: 0 }] });

      await authedApi.expectOk(
        await authedApi.createOrder(new OrderBuilder().build()),
        apiErrorSchema,
        409,
      );

      // The account is created per worker, so its history is empty unless this
      // checkout wrote something — which is the whole question.
      const history = await (await authedApi.orders()).json();
      expect(history.items, 'aucune commande partielle en base').toHaveLength(0);

      // And the cart is still there, still holding its line: a failed payment
      // must not cost the customer their basket.
      const cart = await (await authedApi.cart()).json();
      expect(cart.items).toHaveLength(1);
    },
  );

  test(
    'deux inscriptions simultanées avec la même adresse : une seule aboutit',
    {
      tag: [TAGS.regression, TAGS.security],
      annotation: [
        testCase('TC-404', 'Course sur l’unicité de l’adresse e-mail'),
        covers('REQ-DATA-04'),
      ],
    },
    async ({ api, otherApi }) => {
      const credentials = {
        email: uniqueEmail('doublon'),
        password: 'Doublon2026!',
        firstName: 'Double',
        lastName: 'Inscription',
      };

      const [first, second] = await Promise.all([
        api.register(credentials),
        otherApi.register(credentials),
      ]);

      const statuses = [first.status(), second.status()].sort((a, b) => a - b);
      expect(statuses, 'un compte créé, un conflit').toEqual([201, 409]);

      // The application checks for an existing address before inserting, which
      // two requests can pass at the same instant. What actually settles it is
      // the unique index on lower(email) — a guarantee the database holds and
      // the application cannot.
      const conflict = first.status() === 409 ? first : second;
      expect((await api.expectOk(conflict, apiErrorSchema, 409)).error.code).toBe('CONFLICT');

      const winner = first.status() === 201 ? first : second;
      const account = await api.expectOk(winner, authResponseSchema, 201);
      expect(account.user.email).toBe(credentials.email);

      // And exactly one account answers to that address afterwards.
      const login = await api.login({ email: credentials.email, password: credentials.password });
      expect(login.status()).toBe(200);
    },
  );
});
