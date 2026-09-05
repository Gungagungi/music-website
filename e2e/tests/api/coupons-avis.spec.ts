import { expect, test } from '@/fixtures/api-fixtures';
import {
  apiErrorSchema,
  cartSchema,
  couponPreviewSchema,
  productDetailSchema,
  reviewPageSchema,
  reviewSchema,
} from '@/api/schemas';
import { COUPONS, PRODUCTS, REVIEWS } from '@/data/seed';
import { percentOf } from '@/utils/money';
import { TAGS, covers, testCase } from '@/utils/tags';

test.describe('API — codes promo', () => {
  test(
    'un code valide réduit le total du panier',
    {
      tag: [TAGS.smoke, TAGS.critical],
      annotation: [testCase('TC-270', 'Application d’un code promo'), covers('REQ-API-40')],
    },
    async ({ api }) => {
      const before = await api.addToCartAndTrack({ sku: PRODUCTS.cheap.sku, quantity: 2 });

      const cart = await api.expectOk(await api.applyCoupon(COUPONS.valid.code), cartSchema);

      const expected = percentOf(before.totals.subtotal, COUPONS.valid.percent);
      expect(cart.couponCode).toBe(COUPONS.valid.code);
      expect(cart.totals.discount).toBe(expected);
      expect(cart.totals.total).toBe(cart.totals.subtotal - expected + cart.totals.shipping);
    },
  );

  test.describe('refus', () => {
    // Chaque scénario porte son propre identifiant : trois cas de test partageant
    // un seul TC rendent la matrice de traçabilité fausse — une ligne y couvrirait
    // trois vérifications, et en retirer une passerait inaperçu.
    const cases = [
      {
        tc: 'TC-271',
        name: 'inconnu',
        code: COUPONS.unknown.code,
        status: 404,
        expected: 'COUPON_UNKNOWN',
      },
      {
        tc: 'TC-276',
        name: 'expiré',
        code: COUPONS.expired.code,
        status: 422,
        expected: 'COUPON_EXPIRED',
      },
      {
        tc: 'TC-277',
        name: 'sous le minimum d’achat',
        code: COUPONS.highMinimum.code,
        status: 422,
        expected: 'COUPON_MIN_SUBTOTAL',
      },
    ] as const;

    for (const scenario of cases) {
      test(
        `un code ${scenario.name} est refusé avec le code ${scenario.expected}`,
        {
          tag: [TAGS.regression, TAGS.contract],
          annotation: [testCase(scenario.tc, `Refus de code promo — ${scenario.name}`), covers('REQ-API-41')],
        },
        async ({ api }) => {
          await api.addToCartAndTrack({ sku: PRODUCTS.cheap.sku, quantity: 2 });

          const body = await api.expectOk(
            await api.applyCoupon(scenario.code),
            apiErrorSchema,
            scenario.status,
          );
          expect(body.error.code).toBe(scenario.expected);
        },
      );
    }
  });

  test(
    'un code réservé à une catégorie absente du panier est refusé',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-272', 'Code promo hors catégorie'), covers('REQ-API-42')],
    },
    async ({ api }) => {
      await api.addToCartAndTrack({ sku: PRODUCTS.inStock.sku, quantity: 1 });

      const body = await api.expectOk(
        await api.applyCoupon(COUPONS.categoryScoped.code),
        apiErrorSchema,
        422,
      );
      expect(body.error.code).toBe('COUPON_CATEGORY');
    },
  );

  test(
    'un code devenu invalide est retiré automatiquement quand le panier change',
    {
      tag: [TAGS.regression, TAGS.critical],
      annotation: [testCase('TC-273', 'Réévaluation du code promo'), covers('REQ-API-43')],
    },
    async ({ api }) => {
      // Two units clear the coupon's minimum; one does not.
      await api.addToCartAndTrack({ sku: PRODUCTS.cheap.sku, quantity: 2 });
      const applied = await api.expectOk(await api.applyCoupon(COUPONS.valid.code), cartSchema);
      expect(applied.couponCode).toBe(COUPONS.valid.code);

      const itemId = applied.items[0]!.id;
      const reduced = await api.expectOk(await api.updateCartItem(itemId, 1), cartSchema);

      // A coupon that silently keeps applying below its threshold is a revenue
      // leak, not a cosmetic bug.
      expect(reduced.couponCode).toBeNull();
      expect(reduced.totals.discount).toBe(0);
    },
  );

  test(
    'POST /api/coupons/validate simule la remise sans l’appliquer',
    {
      tag: [TAGS.regression, TAGS.contract],
      annotation: [testCase('TC-274', 'Simulation de code promo'), covers('REQ-API-44')],
    },
    async ({ api }) => {
      const cart = await api.addToCartAndTrack({ sku: PRODUCTS.cheap.sku, quantity: 2 });

      const preview = await api.expectOk(
        await api.validateCoupon(COUPONS.valid.code),
        couponPreviewSchema,
      );
      expect(preview.discount).toBe(percentOf(cart.totals.subtotal, COUPONS.valid.percent));

      const untouched = await api.expectOk(await api.cart(), cartSchema);
      expect(untouched.couponCode).toBeNull();
      expect(untouched.totals.discount).toBe(0);
    },
  );

  test(
    'retirer le code promo restaure le total initial',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-275', 'Retrait de code promo API'), covers('REQ-API-45')],
    },
    async ({ api }) => {
      const initial = await api.addToCartAndTrack({ sku: PRODUCTS.cheap.sku, quantity: 2 });
      await api.applyCoupon(COUPONS.valid.code);

      const cart = await api.expectOk(await api.removeCoupon(), cartSchema);
      expect(cart.couponCode).toBeNull();
      expect(cart.totals.total).toBe(initial.totals.total);
    },
  );
});

test.describe('API — avis clients', () => {
  test(
    'publier un avis exige une authentification',
    {
      tag: [TAGS.security, TAGS.regression],
      annotation: [testCase('TC-280', 'Avis sans authentification'), covers('REQ-SEC-07')],
    },
    async ({ api }) => {
      const body = await api.expectOk(
        await api.createReview(PRODUCTS.inStock.slug, {
          rating: 5,
          title: 'Excellente',
          body: 'Un instrument remarquable, rien à redire sur la finition.',
        }),
        apiErrorSchema,
        401,
      );
      expect(body.error.code).toBe('UNAUTHORIZED');
    },
  );

  test(
    'un avis publié apparaît sur la fiche et fait évoluer la moyenne',
    {
      tag: [TAGS.regression, TAGS.contract],
      annotation: [testCase('TC-281', 'Publication d’un avis'), covers('REQ-API-50')],
    },
    async ({ api, authedApi }) => {
      const before = await api.expectOk(
        await api.product(PRODUCTS.strings.slug),
        productDetailSchema,
      );

      const review = await authedApi.expectOk(
        await authedApi.createReview(PRODUCTS.strings.slug, {
          rating: 5,
          title: 'Tenue d’accord irréprochable',
          body: 'Trois semaines de répétitions intensives et toujours aucune dérive.',
        }),
        reviewSchema,
        201,
      );
      expect(review.rating).toBe(5);

      const after = await api.expectOk(
        await api.product(PRODUCTS.strings.slug),
        productDetailSchema,
      );

      // The aggregate covers the product's whole history, so it must move by one
      // review — not be recomputed from the handful of stored ones.
      expect(after.reviewCount).toBe(before.reviewCount + 1);
      expect(after.reviews.length).toBe(before.reviews.length + 1);
      expect(after.rating).toBeGreaterThanOrEqual(before.rating);
    },
  );

  test(
    'un même client ne peut pas publier deux avis sur le même produit',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-282', 'Avis en doublon'), covers('REQ-API-51')],
    },
    async ({ authedApi }) => {
      const payload = {
        rating: 4,
        title: 'Très bon rapport qualité-prix',
        body: 'Rien à redire pour ce tarif, je recommande sans hésiter à mes élèves.',
      };

      await authedApi.expectOk(
        await authedApi.createReview(PRODUCTS.cheap.slug, payload),
        reviewSchema,
        201,
      );

      const body = await authedApi.expectOk(
        await authedApi.createReview(PRODUCTS.cheap.slug, payload),
        apiErrorSchema,
        409,
      );
      expect(body.error.code).toBe('CONFLICT');
    },
  );

  test(
    'une note hors de l’échelle 1–5 est refusée',
    {
      tag: [TAGS.regression, TAGS.contract],
      annotation: [testCase('TC-283', 'Note invalide'), covers('REQ-API-52')],
    },
    async ({ authedApi }) => {
      const body = await authedApi.expectOk(
        await authedApi.createReview(PRODUCTS.inStock.slug, {
          rating: 6,
          title: 'Au-delà du maximum',
          body: 'Cette note ne devrait pas être acceptée par l’API du tout.',
        }),
        apiErrorSchema,
        422,
      );
      expect(body.error.details?.[0]?.field).toBe('rating');
    },
  );
});

test.describe('API — liste des avis', () => {
  test(
    'la liste est paginée et porte la répartition des notes',
    {
      tag: [TAGS.regression, TAGS.contract],
      annotation: [testCase('TC-284', 'Pagination des avis'), covers('REQ-API-53')],
    },
    async ({ api }) => {
      const page = await api.expectOk(
        await api.reviews(REVIEWS.product, { limit: REVIEWS.pageSize }),
        reviewPageSchema,
      );

      expect(page.items).toHaveLength(REVIEWS.pageSize);
      expect(page.total).toBe(REVIEWS.stored);
      expect(page.totalPages).toBe(REVIEWS.stored / REVIEWS.pageSize);
      expect(page.storedCount).toBe(REVIEWS.stored);
      expect(page.histogram).toEqual(REVIEWS.histogram);
    },
  );

  test(
    'deux pages consécutives ne partagent aucun avis',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-285', 'Étanchéité des pages d’avis'), covers('REQ-API-53')],
    },
    async ({ api }) => {
      // Sorted by rating, where ten reviews share five values: without the tie
      // broken on a unique column, the same row can surface on both pages.
      const first = await api.expectOk(
        await api.reviews(REVIEWS.product, { limit: 5, sort: 'note-desc', page: 1 }),
        reviewPageSchema,
      );
      const second = await api.expectOk(
        await api.reviews(REVIEWS.product, { limit: 5, sort: 'note-desc', page: 2 }),
        reviewPageSchema,
      );

      const ids = new Set([...first.items, ...second.items].map((review) => review.id));
      expect(ids.size).toBe(REVIEWS.stored);
    },
  );

  test(
    'le tri par note ordonne bien la liste entière',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-286', 'Tri des avis par note'), covers('REQ-API-54')],
    },
    async ({ api }) => {
      const page = await api.expectOk(
        await api.reviews(REVIEWS.product, { sort: 'note-asc', limit: REVIEWS.stored }),
        reviewPageSchema,
      );

      const notes = page.items.map((review) => review.rating);
      expect(notes).toEqual([...notes].sort((a, b) => a - b));
      expect(notes[0]).toBe(1);
      expect(notes.at(-1)).toBe(5);
    },
  );

  test(
    'le filtre par note restreint les avis sans toucher à la répartition',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-287', 'Filtre des avis par note'), covers('REQ-API-55')],
    },
    async ({ api }) => {
      const filtered = await api.expectOk(
        await api.reviews(REVIEWS.product, { note: 5 }),
        reviewPageSchema,
      );

      expect(filtered.total).toBe(REVIEWS.histogram[5]);
      expect(filtered.items.every((review) => review.rating === 5)).toBe(true);
      // The histogram is what the filter is applied *from*; recomputing it under
      // the filter would leave a single bar and no way back.
      expect(filtered.histogram).toEqual(REVIEWS.histogram);
      expect(filtered.storedCount).toBe(REVIEWS.stored);
    },
  );

  test(
    'une note de filtre hors de l’échelle est refusée',
    {
      tag: [TAGS.regression, TAGS.contract],
      annotation: [testCase('TC-288', 'Filtre d’avis invalide'), covers('REQ-API-55')],
    },
    async ({ api }) => {
      const body = await api.expectOk(
        await api.reviews(REVIEWS.product, { note: 9 }),
        apiErrorSchema,
        422,
      );
      expect(body.error.code).toBe('VALIDATION_ERROR');
    },
  );

  test(
    'un avis publié par un client sans commande n’est pas marqué « achat vérifié »',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-289', 'Badge achat vérifié'), covers('REQ-API-56')],
    },
    async ({ authedApi }) => {
      const review = await authedApi.expectOk(
        await authedApi.createReview(PRODUCTS.leftHanded.slug, {
          rating: 4,
          title: 'Bonne surprise pour une gauchère',
          body: 'Les modèles gauchers de ce niveau sont rares, celui-ci tient ses promesses.',
        }),
        reviewSchema,
        201,
      );

      // The account is created by the fixture and has ordered nothing, so the
      // badge must be absent — it is a claim about the order history, not a
      // decoration on any signed-in opinion.
      expect(review.verifiedPurchase).toBe(false);
    },
  );
});
