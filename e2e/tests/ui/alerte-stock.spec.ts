import { expect, test } from '@/fixtures/test-fixtures';
import { PRODUCTS } from '@/data/seed';
import { TAGS, covers, testCase } from '@/utils/tags';

/**
 * The restock alert, from the product page.
 *
 * The control only exists on an unavailable product, and only for a signed-in
 * customer — both are decided on the server, so the right thing is in the
 * served HTML rather than appearing once hydration catches up.
 */
test.describe('Alerte de retour en stock', () => {
  test(
    'un produit disponible n’offre pas d’alerte',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-467', 'Pas d’alerte sur produit disponible'), covers('REQ-ALERT-02')],
    },
    async ({ productPage, page }) => {
      await productPage.openProduct(PRODUCTS.inStock.slug);

      await expect(page.getByTestId('stock-alert-toggle')).toHaveCount(0);
      await expect(page.getByTestId('alert-signin-hint')).toHaveCount(0);
    },
  );

  test(
    'un visiteur non connecté est invité à se connecter',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-468', 'Alerte sans compte'), covers('REQ-ALERT-02')],
    },
    async ({ productPage, page }) => {
      await productPage.openProduct(PRODUCTS.outOfStock.slug);

      // The API answers 401, so a button that can only fail is worse than the
      // link that fixes it.
      await expect(page.getByTestId('stock-alert-toggle')).toHaveCount(0);
      await expect(page.getByTestId('alert-signin-hint')).toBeVisible();
    },
  );

  test(
    'un client connecté demande à être prévenu et retrouve son alerte',
    {
      tag: [TAGS.smoke, TAGS.regression],
      annotation: [testCase('TC-469', 'Inscription à une alerte'), covers('REQ-ALERT-03')],
    },
    async ({ productPage, page, api, registeredUser, signInAs }) => {
      await api.seed({ stock: [{ slug: PRODUCTS.alertTarget.slug, quantity: 0 }] });
      await signInAs(registeredUser.credentials.email, registeredUser.credentials.password);
      await productPage.openProduct(PRODUCTS.alertTarget.slug);

      await page.getByTestId('stock-alert-toggle').click();
      await expect(page.getByTestId('stock-alert-status')).toHaveAttribute(
        'data-status',
        'success',
      );
      await expect(page.getByTestId('stock-alert-toggle')).toHaveAttribute(
        'data-subscribed',
        'true',
      );

      await page.goto('/compte/alertes');
      const item = page.locator(
        `[data-testid="alert-item"][data-slug="${PRODUCTS.alertTarget.slug}"]`,
      );
      await expect(item).toBeVisible();
      await expect(item.getByTestId('alert-state')).toHaveText('En attente');
    },
  );

  test(
    'le même bouton annule l’alerte',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-470', 'Annulation depuis la fiche'), covers('REQ-ALERT-03')],
    },
    async ({ productPage, page, api, registeredUser, signInAs }) => {
      await api.seed({ stock: [{ slug: PRODUCTS.alertTarget.slug, quantity: 0 }] });
      await signInAs(registeredUser.credentials.email, registeredUser.credentials.password);
      await productPage.openProduct(PRODUCTS.alertTarget.slug);

      const toggle = page.getByTestId('stock-alert-toggle');
      await toggle.click();
      await expect(toggle).toHaveAttribute('data-subscribed', 'true');

      await toggle.click();
      await expect(toggle).toHaveAttribute('data-subscribed', 'false');
    },
  );

  test(
    'un client sans alerte voit un état vide qui explique la marche à suivre',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-471', 'Aucune alerte'), covers('REQ-ALERT-03')],
    },
    async ({ page, registeredUser, signInAs }) => {
      await signInAs(registeredUser.credentials.email, registeredUser.credentials.password);
      await page.goto('/compte/alertes');

      await expect(page.getByTestId('alerts-empty')).toBeVisible();
    },
  );

  test(
    'la page des alertes exige une connexion',
    {
      tag: [TAGS.security, TAGS.regression],
      annotation: [testCase('TC-472', 'Alertes protégées'), covers('REQ-ALERT-02')],
    },
    async ({ page }) => {
      await page.goto('/compte/alertes');

      await page.waitForURL('**/compte/connexion**');
    },
  );
});
