import { expect, test } from '@/fixtures/api-fixtures';
import {
  apiErrorSchema,
  orderListSchema,
  orderWithTokenSchema,
  productDetailSchema,
} from '@/api/schemas';
import { AddressBuilder } from '@/data/builders/AddressBuilder';
import { OrderBuilder } from '@/data/builders/OrderBuilder';
import { PRODUCTS } from '@/data/seed';
import { uniqueEmail } from '@/utils/unique';
import { TAGS, covers, testCase } from '@/utils/tags';

test.describe('API — commandes', () => {
  test(
    'POST /api/orders transforme le panier en commande confirmée',
    {
      tag: [TAGS.smoke, TAGS.contract, TAGS.critical],
      annotation: [testCase('TC-250', 'Création de commande'), covers('REQ-API-30')],
    },
    async ({ authedApi }) => {
      const cart = await authedApi.addToCartAndTrack({ sku: PRODUCTS.cheap.sku, quantity: 2 });

      const order = await authedApi.expectOk(
        await authedApi.createOrder(new OrderBuilder().build()),
        orderWithTokenSchema,
        201,
      );

      expect(order.reference).toMatch(/^FRT-\d{6}$/);
      expect(order.status).toBe('confirmee');
      expect(order.items).toHaveLength(1);
      expect(order.totals.total).toBe(cart.totals.total);
    },
  );

  test(
    'la commande décrémente le stock du produit',
    {
      tag: [TAGS.regression, TAGS.critical],
      annotation: [testCase('TC-251', 'Décrément du stock'), covers('REQ-API-31')],
    },
    async ({ api, authedApi }) => {
      // A read-modify-read assertion needs a product no other spec touches;
      // otherwise a concurrent order in another worker moves the number between
      // the two reads.
      const product = PRODUCTS.stockTracking;
      const before = await api.expectOk(await api.product(product.slug), productDetailSchema);

      await authedApi.addToCartAndTrack({ sku: product.sku, quantity: 2 });
      await authedApi.expectOk(
        await authedApi.createOrder(new OrderBuilder().build()),
        orderWithTokenSchema,
        201,
      );

      const after = await api.expectOk(await api.product(product.slug), productDetailSchema);
      expect(after.stock).toBe(before.stock - 2);
    },
  );

  test(
    'le panier est vidé après la commande',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-252', 'Panier vidé — API'), covers('REQ-API-32')],
    },
    async ({ authedApi }) => {
      await authedApi.addToCartAndTrack({ sku: PRODUCTS.cheap.sku, quantity: 1 });
      await authedApi.expectOk(
        await authedApi.createOrder(new OrderBuilder().build()),
        orderWithTokenSchema,
        201,
      );

      const cart = await (await authedApi.cart()).json();
      expect(cart.items).toHaveLength(0);
    },
  );

  test(
    'commander avec un panier vide est refusé',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-253', 'Commande sans article'), covers('REQ-API-33')],
    },
    async ({ authedApi }) => {
      const body = await authedApi.expectOk(
        await authedApi.createOrder(new OrderBuilder().build()),
        apiErrorSchema,
        422,
      );
      expect(body.error.code).toBe('EMPTY_CART');
    },
  );

  test(
    'une adresse incomplète est rejetée champ par champ',
    {
      tag: [TAGS.regression, TAGS.contract],
      annotation: [testCase('TC-254', 'Validation de l’adresse API'), covers('REQ-API-34')],
    },
    async ({ authedApi }) => {
      await authedApi.addToCartAndTrack({ sku: PRODUCTS.cheap.sku, quantity: 1 });

      const payload = new OrderBuilder()
        .withShippingAddress(new AddressBuilder().without('city').withPostalCode('ABCDE').build())
        .build();

      const body = await authedApi.expectOk(
        await authedApi.createOrder(payload),
        apiErrorSchema,
        422,
      );

      const fields = body.error.details?.map((detail) => detail.field) ?? [];
      expect(fields).toContain('shippingAddress.city');
      expect(fields).toContain('shippingAddress.postalCode');
    },
  );

  test(
    'les conditions générales doivent être acceptées',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-255', 'CGV côté API'), covers('REQ-API-35')],
    },
    async ({ authedApi }) => {
      await authedApi.addToCartAndTrack({ sku: PRODUCTS.cheap.sku, quantity: 1 });

      const body = await authedApi.expectOk(
        await authedApi.createOrder(new OrderBuilder().withoutAcceptingTerms().build()),
        apiErrorSchema,
        422,
      );
      expect(body.error.details?.some((detail) => detail.field === 'acceptTerms')).toBe(true);
    },
  );

  test(
    'une commande invité exige une adresse e-mail',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-256', 'Commande invité sans e-mail'), covers('REQ-API-36')],
    },
    async ({ api }) => {
      await api.addToCartAndTrack({ sku: PRODUCTS.cheap.sku, quantity: 1 });

      const body = await api.expectOk(
        await api.createOrder(new OrderBuilder().build()),
        apiErrorSchema,
        422,
      );
      expect(body.error.details?.[0]?.field).toBe('email');
    },
  );

  test(
    'une commande invité est lisible avec son jeton d’accès, et seulement avec lui',
    {
      tag: [TAGS.security, TAGS.critical, TAGS.regression],
      annotation: [testCase('TC-257', 'Jeton de commande invité'), covers('REQ-SEC-05')],
    },
    async ({ api, otherApi }) => {
      await api.addToCartAndTrack({ sku: PRODUCTS.cheap.sku, quantity: 1 });
      const order = await api.expectOk(
        await api.createOrder(new OrderBuilder().asGuest(uniqueEmail('invite')).build()),
        orderWithTokenSchema,
        201,
      );

      // With the token: readable.
      const withToken = await otherApi.order(order.id, order.accessToken);
      expect(withToken.status()).toBe(200);

      // Without it: a sequential reference must not be a back door.
      const withoutToken = await otherApi.expectOk(
        await otherApi.order(order.id),
        apiErrorSchema,
        401,
      );
      expect(withoutToken.error.code).toBe('UNAUTHORIZED');
    },
  );

  test(
    'un client ne peut pas lire la commande d’un autre',
    {
      tag: [TAGS.security, TAGS.critical],
      annotation: [testCase('TC-258', 'Cloisonnement des commandes'), covers('REQ-SEC-06')],
    },
    async ({ authedApi, otherApi }) => {
      await authedApi.addToCartAndTrack({ sku: PRODUCTS.cheap.sku, quantity: 1 });
      const order = await authedApi.expectOk(
        await authedApi.createOrder(new OrderBuilder().build()),
        orderWithTokenSchema,
        201,
      );

      const intruder = await otherApi.registerAndAuthenticate({
        email: uniqueEmail('intrus'),
        password: 'Intrusion2026!',
        firstName: 'Intrus',
        lastName: 'Curieux',
      });
      expect(intruder.token).toBeTruthy();

      // 403 and not 404: the resource exists, the caller simply has no right to
      // it. Collapsing the two would hide authorisation bugs behind 404s.
      const body = await otherApi.expectOk(await otherApi.order(order.id), apiErrorSchema, 403);
      expect(body.error.code).toBe('FORBIDDEN');
    },
  );

  test(
    'GET /api/orders ne retourne que les commandes du porteur du jeton',
    {
      tag: [TAGS.security, TAGS.contract, TAGS.critical],
      annotation: [testCase('TC-259', 'Historique cloisonné'), covers('REQ-SEC-06')],
    },
    async ({ authedApi, otherApi }) => {
      await authedApi.addToCartAndTrack({ sku: PRODUCTS.cheap.sku, quantity: 1 });
      const mine = await authedApi.expectOk(
        await authedApi.createOrder(new OrderBuilder().build()),
        orderWithTokenSchema,
        201,
      );

      const list = await authedApi.expectOk(await authedApi.orders(), orderListSchema);
      expect(list.items.map((order) => order.reference)).toContain(mine.reference);

      await otherApi.registerAndAuthenticate({
        email: uniqueEmail('voisin'),
        password: 'Voisin2026!',
        firstName: 'Voisin',
        lastName: 'Discret',
      });
      const theirList = await otherApi.expectOk(await otherApi.orders(), orderListSchema);
      expect(theirList.items).toHaveLength(0);

      // The list must never leak the one-time guest token.
      expect(JSON.stringify(list)).not.toContain('accessToken');
    },
  );

  test(
    'GET /api/orders exige une authentification',
    {
      tag: [TAGS.security, TAGS.smoke],
      annotation: [testCase('TC-260', 'Historique sans jeton'), covers('REQ-SEC-02')],
    },
    async ({ api }) => {
      const body = await api.expectOk(await api.orders(), apiErrorSchema, 401);
      expect(body.error.code).toBe('UNAUTHORIZED');
    },
  );
});
