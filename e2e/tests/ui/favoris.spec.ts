import { expect, test } from '@/fixtures/test-fixtures';
import { PRODUCTS } from '@/data/seed';
import { TAGS, covers, testCase } from '@/utils/tags';

/**
 * Favourites, from the product page and the account area.
 *
 * The control's label depends on server state, so it is asserted on served
 * HTML after a refresh rather than on a locally flipped label.
 */
test.describe('Favoris', () => {
  test(
    'un visiteur non connecté est renvoyé vers la connexion',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-492', 'Favori sans compte'), covers('REQ-WISH-02')],
    },
    async ({ productPage, page }) => {
      await productPage.openProduct(PRODUCTS.inStock.slug);

      // A heart that can only answer 401 is worse than the link that fixes it.
      await expect(page.getByTestId('wishlist-toggle')).toHaveCount(0);
      await expect(page.getByTestId('wishlist-signin-hint')).toBeVisible();
    },
  );

  test(
    'un client enregistre un produit et le retrouve dans ses favoris',
    {
      tag: [TAGS.smoke, TAGS.regression],
      annotation: [testCase('TC-493', 'Enregistrement d’un favori'), covers('REQ-WISH-01')],
    },
    async ({ productPage, page, registeredUser, signInAs }) => {
      await signInAs(registeredUser.credentials.email, registeredUser.credentials.password);
      await productPage.openProduct(PRODUCTS.inStock.slug);

      const toggle = page.getByTestId('wishlist-toggle');
      await toggle.click();
      await expect(toggle).toHaveAttribute('data-saved', 'true');

      await page.goto('/compte/favoris');
      // Scoped to the card: `data-slug` also sits on the comparison toggle
      // inside it, so an unscoped selector resolves to two elements.
      await expect(
        page.locator(
          `[data-testid="wishlist"] [data-testid="product-card"][data-slug="${PRODUCTS.inStock.slug}"]`,
        ),
      ).toBeVisible();
    },
  );

  test(
    'le même bouton retire le favori',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-494', 'Retrait d’un favori'), covers('REQ-WISH-01')],
    },
    async ({ productPage, page, registeredUser, signInAs }) => {
      await signInAs(registeredUser.credentials.email, registeredUser.credentials.password);
      await productPage.openProduct(PRODUCTS.cheap.slug);

      const toggle = page.getByTestId('wishlist-toggle');
      await toggle.click();
      await expect(toggle).toHaveAttribute('data-saved', 'true');

      await toggle.click();
      await expect(toggle).toHaveAttribute('data-saved', 'false');

      await page.goto('/compte/favoris');
      await expect(page.getByTestId('wishlist-empty')).toBeVisible();
    },
  );

  test(
    'un client sans favori voit un état vide qui explique la marche à suivre',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-495', 'Aucun favori'), covers('REQ-WISH-01')],
    },
    async ({ page, registeredUser, signInAs }) => {
      await signInAs(registeredUser.credentials.email, registeredUser.credentials.password);
      await page.goto('/compte/favoris');

      await expect(page.getByTestId('wishlist-empty')).toBeVisible();
    },
  );

  test(
    'la page des favoris exige une connexion',
    {
      tag: [TAGS.security, TAGS.regression],
      annotation: [testCase('TC-496', 'Favoris protégés'), covers('REQ-WISH-02')],
    },
    async ({ page }) => {
      await page.goto('/compte/favoris');

      await page.waitForURL('**/compte/connexion**');
    },
  );
});
