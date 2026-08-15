import { expect, test } from '@/fixtures/api-fixtures';
import { apiErrorSchema, cartSchema } from '@/api/schemas';
import { PRODUCTS, RULES } from '@/data/seed';
import { shippingFor, vatIncludedIn } from '@/utils/money';
import { TAGS, covers, testCase } from '@/utils/tags';

test.describe('API — panier', () => {
  test(
    'ajouter un article crée un panier et calcule les totaux',
    {
      tag: [TAGS.smoke, TAGS.contract, TAGS.critical],
      annotation: [testCase('TC-230', 'Ajout au panier API'), covers('REQ-API-20')],
    },
    async ({ api }) => {
      const response = await api.addToCart({ sku: PRODUCTS.cheap.sku, quantity: 2 });
      const cart = await api.expectOk(response, cartSchema, 201);

      expect(cart.items).toHaveLength(1);
      expect(cart.items[0]?.quantity).toBe(2);
      expect(cart.items[0]?.lineTotal).toBe(PRODUCTS.cheap.priceCents * 2);
      expect(cart.totals.subtotal).toBe(PRODUCTS.cheap.priceCents * 2);
      expect(cart.totals.itemCount).toBe(2);
    },
  );

  test(
    'les totaux respectent les règles de port et de TVA',
    {
      tag: [TAGS.regression, TAGS.critical],
      annotation: [testCase('TC-231', 'Calcul des totaux'), covers('REQ-API-21')],
    },
    async ({ api }) => {
      const cart = await api.addToCartAndTrack({ sku: PRODUCTS.cheap.sku, quantity: 3 });
      const body = await api.expectOk(await api.cart(), cartSchema);

      const subtotal = PRODUCTS.cheap.priceCents * 3;
      expect(cart.totals.subtotal).toBe(subtotal);
      expect(body.totals.shipping).toBe(shippingFor(subtotal));
      expect(body.totals.total).toBe(subtotal + shippingFor(subtotal));
      expect(body.totals.vat).toBe(vatIncludedIn(body.totals.total));
    },
  );

  test(
    'ajouter deux fois le même article cumule la quantité sur une seule ligne',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-232', 'Cumul de quantité'), covers('REQ-API-22')],
    },
    async ({ api }) => {
      await api.addToCartAndTrack({ sku: PRODUCTS.cheap.sku, quantity: 1 });
      const cart = await api.expectOk(
        await api.addToCart({ sku: PRODUCTS.cheap.sku, quantity: 2 }),
        cartSchema,
        201,
      );

      expect(cart.items).toHaveLength(1);
      expect(cart.items[0]?.quantity).toBe(3);
    },
  );

  test(
    'deux coloris du même produit forment deux lignes distinctes',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-233', 'Lignes par coloris'), covers('REQ-API-22')],
    },
    async ({ api }) => {
      await api.addToCartAndTrack({ sku: PRODUCTS.inStock.sku, quantity: 1, color: 'Ebony' });
      const cart = await api.expectOk(
        await api.addToCart({ sku: PRODUCTS.inStock.sku, quantity: 1, color: 'Bourbon Burst' }),
        cartSchema,
        201,
      );

      expect(cart.items).toHaveLength(2);
      expect(cart.items.map((item) => item.color).sort()).toEqual(['Bourbon Burst', 'Ebony']);
    },
  );

  test(
    'modifier une quantité recalcule la ligne et les totaux',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-234', 'Mise à jour de quantité API'), covers('REQ-API-23')],
    },
    async ({ api }) => {
      const created = await api.addToCartAndTrack({ sku: PRODUCTS.cheap.sku, quantity: 1 });
      const itemId = (await (await api.cart()).json()).items[0].id as string;

      const cart = await api.expectOk(await api.updateCartItem(itemId, 4), cartSchema);

      expect(cart.id).toBe(created.id);
      expect(cart.items[0]?.quantity).toBe(4);
      expect(cart.totals.subtotal).toBe(PRODUCTS.cheap.priceCents * 4);
    },
  );

  test(
    'mettre une quantité à zéro retire la ligne',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-235', 'Quantité zéro'), covers('REQ-API-23')],
    },
    async ({ api }) => {
      await api.addToCartAndTrack({ sku: PRODUCTS.cheap.sku, quantity: 1 });
      const itemId = (await (await api.cart()).json()).items[0].id as string;

      const cart = await api.expectOk(await api.updateCartItem(itemId, 0), cartSchema);
      expect(cart.items).toHaveLength(0);
      expect(cart.totals.total).toBe(0);
    },
  );

  test(
    'supprimer une ligne inexistante renvoie 404',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-236', 'Ligne de panier introuvable'), covers('REQ-API-24')],
    },
    async ({ api }) => {
      await api.addToCartAndTrack({ sku: PRODUCTS.cheap.sku, quantity: 1 });

      const body = await api.expectOk(
        await api.removeCartItem('00000000-0000-4000-8000-000000000000'),
        apiErrorSchema,
        404,
      );
      expect(body.error.code).toBe('NOT_FOUND');
    },
  );

  test(
    'un produit en rupture ne peut pas être ajouté',
    {
      tag: [TAGS.regression, TAGS.critical],
      annotation: [testCase('TC-237', 'Ajout d’un produit épuisé'), covers('REQ-API-25')],
    },
    async ({ api }) => {
      const body = await api.expectOk(
        await api.addToCart({ sku: PRODUCTS.outOfStock.sku, quantity: 1 }),
        apiErrorSchema,
        409,
      );
      expect(body.error.code).toBe('OUT_OF_STOCK');
    },
  );

  test(
    'la quantité par ligne est plafonnée côté serveur',
    {
      tag: [TAGS.regression, TAGS.security],
      annotation: [testCase('TC-238', 'Plafond de quantité serveur'), covers('REQ-API-26')],
    },
    async ({ api }) => {
      // The UI caps this with a `max` attribute; the server must cap it too,
      // because an attribute is a suggestion, not a control.
      const body = await api.expectOk(
        await api.postRaw('/api/cart/items', {
          sku: PRODUCTS.inStock.sku,
          quantity: RULES.maxQuantityPerLine + 1,
        }),
        apiErrorSchema,
        422,
      );
      expect(body.error.code).toBe('VALIDATION_ERROR');
    },
  );

  test(
    'un coloris inexistant est refusé avec la liste des coloris valides',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-239', 'Coloris invalide'), covers('REQ-API-27')],
    },
    async ({ api }) => {
      const body = await api.expectOk(
        await api.addToCart({ sku: PRODUCTS.inStock.sku, quantity: 1, color: 'Rose fluo' }),
        apiErrorSchema,
        422,
      );

      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.details?.[0]?.field).toBe('color');
    },
  );

  test(
    'vider le panier remet les totaux à zéro',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-240', 'Vidage du panier'), covers('REQ-API-28')],
    },
    async ({ api }) => {
      await api.addToCartAndTrack({ sku: PRODUCTS.cheap.sku, quantity: 2 });

      const cart = await api.expectOk(await api.clearCart(), cartSchema);
      expect(cart.items).toHaveLength(0);
      expect(cart.totals).toMatchObject({ subtotal: 0, total: 0, itemCount: 0, shipping: 0 });
    },
  );

  test(
    'deux clients ne partagent pas leur panier',
    {
      tag: [TAGS.regression, TAGS.security, TAGS.critical],
      annotation: [testCase('TC-241', 'Isolation des paniers'), covers('REQ-SEC-04')],
    },
    async ({ api, otherApi }) => {
      const mine = await api.addToCartAndTrack({ sku: PRODUCTS.cheap.sku, quantity: 2 });
      const theirs = await otherApi.addToCartAndTrack({ sku: PRODUCTS.strings.sku, quantity: 1 });

      expect(mine.id).not.toBe(theirs.id);

      const myCart = await api.expectOk(await api.cart(), cartSchema);
      expect(myCart.items).toHaveLength(1);
      expect(myCart.items[0]?.sku).toBe(PRODUCTS.cheap.sku);
    },
  );
});
