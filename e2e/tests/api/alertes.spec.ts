import { expect, test } from '@/fixtures/api-fixtures';
import { apiErrorSchema, stockAlertListSchema, stockAlertSchema } from '@/api/schemas';
import { PRODUCTS } from '@/data/seed';
import { TAGS, covers, testCase } from '@/utils/tags';

/**
 * Restock alerts.
 *
 * The rule worth testing is not the mail — sending is out of scope, and a real
 * SMTP dependency would make the suite need a mail server. It is *which* alerts
 * fire, and that each fires exactly once.
 *
 * Every spec here arranges its own account, so the only shared state is a stock
 * level. The specs that need an empty shelf share one product — they agree on
 * what it should be — and the one that needs an available product has its own,
 * because `fullyParallel` would otherwise let the two arrangements interleave.
 */
test.describe('API — alertes de retour en stock', () => {
  test(
    's’inscrire à une alerte exige une authentification',
    {
      tag: [TAGS.security, TAGS.regression],
      annotation: [testCase('TC-473', 'Alerte sans authentification'), covers('REQ-API-57')],
    },
    async ({ api }) => {
      const body = await api.expectOk(
        await api.subscribeToRestock(PRODUCTS.alertTarget.slug),
        apiErrorSchema,
        401,
      );
      expect(body.error.code).toBe('UNAUTHORIZED');
    },
  );

  test(
    'un produit disponible ne peut pas faire l’objet d’une alerte',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-474', 'Alerte sur produit disponible'), covers('REQ-API-57')],
    },
    async ({ api, authedApi }) => {
      await api.seed({ stock: [{ slug: PRODUCTS.alertAvailableTarget.slug, quantity: 5 }] });

      // The alert would fire on the very next sweep, which is not what
      // "prévenez-moi quand il revient" asks for.
      const body = await authedApi.expectOk(
        await authedApi.subscribeToRestock(PRODUCTS.alertAvailableTarget.slug),
        apiErrorSchema,
        409,
      );
      expect(body.error.code).toBe('CONFLICT');
    },
  );

  test(
    's’inscrire deux fois ne crée qu’une alerte',
    {
      tag: [TAGS.regression, TAGS.contract],
      annotation: [testCase('TC-475', 'Inscription idempotente'), covers('REQ-API-58')],
    },
    async ({ api, authedApi }) => {
      await api.seed({ stock: [{ slug: PRODUCTS.alertTarget.slug, quantity: 0 }] });

      const first = await authedApi.expectOk(
        await authedApi.subscribeToRestock(PRODUCTS.alertTarget.slug),
        stockAlertSchema,
        201,
      );
      // A double-click is not a request to be told twice, so this answers 201
      // with the same row rather than 409.
      const second = await authedApi.expectOk(
        await authedApi.subscribeToRestock(PRODUCTS.alertTarget.slug),
        stockAlertSchema,
        201,
      );

      expect(second.id).toBe(first.id);

      const mine = await authedApi.expectOk(await authedApi.myAlerts(), stockAlertListSchema);
      expect(mine.items.filter((alert) => alert.slug === PRODUCTS.alertTarget.slug)).toHaveLength(1);
    },
  );

  test(
    'un client ne voit que ses propres alertes',
    {
      tag: [TAGS.security, TAGS.regression],
      annotation: [testCase('TC-476', 'Cloisonnement des alertes'), covers('REQ-API-59')],
    },
    async ({ api, authedApi, otherAuthedApi }) => {
      await api.seed({ stock: [{ slug: PRODUCTS.alertTarget.slug, quantity: 0 }] });
      await authedApi.subscribeToRestock(PRODUCTS.alertTarget.slug);

      const theirs = await otherAuthedApi.expectOk(
        await otherAuthedApi.myAlerts(),
        stockAlertListSchema,
      );

      expect(theirs.items.some((alert) => alert.slug === PRODUCTS.alertTarget.slug)).toBe(false);
    },
  );

  test(
    'une alerte peut être annulée, et l’annuler deux fois échoue',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-477', 'Annulation d’une alerte'), covers('REQ-API-58')],
    },
    async ({ api, authedApi }) => {
      await api.seed({ stock: [{ slug: PRODUCTS.alertTarget.slug, quantity: 0 }] });
      await authedApi.subscribeToRestock(PRODUCTS.alertTarget.slug);

      expect((await authedApi.cancelRestockAlert(PRODUCTS.alertTarget.slug)).status()).toBe(200);

      const body = await authedApi.expectOk(
        await authedApi.cancelRestockAlert(PRODUCTS.alertTarget.slug),
        apiErrorSchema,
        404,
      );
      expect(body.error.code).toBe('NOT_FOUND');
    },
  );

  test(
    'le retour en stock déclenche l’alerte, une seule fois',
    {
      tag: [TAGS.regression, TAGS.critical],
      annotation: [testCase('TC-478', 'Déclenchement au retour en stock'), covers('REQ-ALERT-01')],
    },
    async ({ api, authedApi }) => {
      await api.seed({ stock: [{ slug: PRODUCTS.restockTarget.slug, quantity: 0 }] });
      await authedApi.subscribeToRestock(PRODUCTS.restockTarget.slug);

      const pending = await authedApi.expectOk(await authedApi.myAlerts(), stockAlertListSchema);
      expect(
        pending.items.find((alert) => alert.slug === PRODUCTS.restockTarget.slug)?.notifiedAt,
      ).toBeNull();

      await api.seed({ stock: [{ slug: PRODUCTS.restockTarget.slug, quantity: 4 }] });
      await api.sweepRestockAlerts();

      const after = await authedApi.expectOk(await authedApi.myAlerts(), stockAlertListSchema);
      const notified = after.items.find((alert) => alert.slug === PRODUCTS.restockTarget.slug);
      expect(notified?.notifiedAt).not.toBeNull();

      // The row stays, marked, rather than being deleted: a second restock must
      // not re-notify someone who asked once and never asked again.
      const firstNotification = notified?.notifiedAt;
      await api.sweepRestockAlerts();

      const again = await authedApi.expectOk(await authedApi.myAlerts(), stockAlertListSchema);
      expect(
        again.items.find((alert) => alert.slug === PRODUCTS.restockTarget.slug)?.notifiedAt,
      ).toBe(firstNotification);
    },
  );

  test(
    'une alerte sur un produit toujours en rupture ne se déclenche pas',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-479', 'Balayage sans retour en stock'), covers('REQ-ALERT-01')],
    },
    async ({ api, authedApi }) => {
      await api.seed({ stock: [{ slug: PRODUCTS.alertTarget.slug, quantity: 0 }] });
      await authedApi.subscribeToRestock(PRODUCTS.alertTarget.slug);

      await api.sweepRestockAlerts();

      const mine = await authedApi.expectOk(await authedApi.myAlerts(), stockAlertListSchema);
      expect(
        mine.items.find((alert) => alert.slug === PRODUCTS.alertTarget.slug)?.notifiedAt,
      ).toBeNull();
    },
  );
});
