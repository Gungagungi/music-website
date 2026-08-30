import { expect, test } from '@/fixtures/test-fixtures';
import { PRODUCTS, REVIEWS } from '@/data/seed';
import { TAGS, covers, testCase } from '@/utils/tags';

/**
 * The reviews block of the product page.
 *
 * Sort, star filter and pagination all live in the URL and are rendered on the
 * server, so every assertion here is on served HTML rather than on a client
 * transition — no polling, no timeouts.
 */
test.describe('Fiche produit — avis clients', () => {
  test(
    'la répartition des notes reflète les avis stockés',
    {
      tag: [TAGS.smoke, TAGS.regression],
      annotation: [testCase('TC-448', 'Histogramme des notes'), covers('REQ-REV-01')],
    },
    async ({ productPage }) => {
      await productPage.openProduct(REVIEWS.product);

      await expect(productPage.reviewHistogram).toBeVisible();
      for (const [level, expected] of Object.entries(REVIEWS.histogram)) {
        expect(await productPage.histogramCount(Number(level))).toBe(expected);
      }

      // The average covers the product's whole history; the stored reviews are
      // only its most recent slice. The summary has to state both, or the two
      // numbers read as a contradiction.
      await expect(productPage.reviewsSummary).toContainText(`${REVIEWS.stored} avis détaillé`);
    },
  );

  test(
    'la liste d’avis se pagine sans répéter ni perdre un avis',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-449', 'Pagination des avis'), covers('REQ-REV-02')],
    },
    async ({ productPage, page }) => {
      await productPage.openProduct(REVIEWS.product);
      await expect(productPage.reviews).toHaveCount(REVIEWS.pageSize);

      const firstPage = await productPage.reviews.allInnerTexts();

      // Waiting on the URL, not on the list: the click is a server navigation,
      // and reading the rows before it lands compares page 1 with itself.
      await page.getByTestId('pagination-page-2').click();
      await page.waitForURL(/avis-page=2/);
      await productPage.waitForHydration();

      const secondPage = await productPage.reviews.allInnerTexts();
      expect(secondPage).toHaveLength(REVIEWS.stored - REVIEWS.pageSize);
      expect(new Set([...firstPage, ...secondPage]).size).toBe(REVIEWS.stored);
    },
  );

  test(
    'trier par notes les plus basses remonte l’avis à une étoile',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-450', 'Tri des avis'), covers('REQ-REV-03')],
    },
    async ({ productPage }) => {
      await productPage.openProduct(REVIEWS.product);
      await productPage.sortReviews('note-asc');

      await expect(productPage.reviews.first()).toHaveAttribute('data-rating', '1');
    },
  );

  test(
    'cliquer une barre filtre la liste, la recliquer la rétablit',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-451', 'Filtre des avis par note'), covers('REQ-REV-04')],
    },
    async ({ productPage, page }) => {
      await productPage.openProduct(REVIEWS.product);

      await productPage.histogramBar(5).click();
      await page.waitForURL(/avis-note=5/);
      await productPage.waitForHydration();

      await expect(productPage.reviews).toHaveCount(REVIEWS.histogram[5]);
      for (const item of await productPage.reviews.all()) {
        await expect(item).toHaveAttribute('data-rating', '5');
      }
      // The bar the filter came from must stay at its full count: it is the
      // control the reader uses to change or clear the filter.
      expect(await productPage.histogramCount(1)).toBe(REVIEWS.histogram[1]);

      await productPage.histogramBar(5).click();
      await page.waitForURL((url) => !url.search.includes('avis-note'));
      await productPage.waitForHydration();
      await expect(productPage.reviews).toHaveCount(REVIEWS.pageSize);
    },
  );

  test(
    'un filtre sur une note sans avis annonce le vide sans perdre le retour',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-452', 'Filtre d’avis sans résultat'), covers('REQ-REV-04')],
    },
    async ({ productPage, page }) => {
      // A product whose only stored reviews are five stars, filtered on one.
      await productPage.openProduct(PRODUCTS.leftHanded.slug, { 'avis-note': '1' });

      await expect(productPage.noReviews).toBeVisible();
      await expect(page.getByTestId('histogram-reset')).toBeVisible();
    },
  );

  test(
    'les avis issus d’une commande portent la mention « achat vérifié »',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-453', 'Mention achat vérifié'), covers('REQ-REV-05')],
    },
    async ({ productPage }) => {
      await productPage.openProduct(REVIEWS.product, { 'avis-tri': 'anciens' });

      // The oldest stored review is a verified purchase, so the badge is on the
      // first row whatever the page size.
      await expect(productPage.reviews.first()).toHaveAttribute('data-verified', 'true');
      await expect(productPage.verifiedBadges.first()).toBeVisible();
    },
  );

  test(
    'un visiteur non connecté est invité à se connecter plutôt qu’à saisir un avis',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-454', 'Dépôt d’avis sans compte'), covers('REQ-REV-06')],
    },
    async ({ productPage }) => {
      await productPage.openProduct(REVIEWS.product);

      // The form is absent from the served HTML, not merely disabled: the API
      // answers 401, so offering a form that can only fail is worse than a link.
      await expect(productPage.reviewForm).toHaveCount(0);
      await expect(productPage.reviewSigninHint).toBeVisible();
    },
  );

  test(
    'un client connecté publie un avis qui apparaît aussitôt sur la fiche',
    {
      tag: [TAGS.regression, TAGS.critical],
      annotation: [testCase('TC-455', 'Publication d’un avis depuis la fiche'), covers('REQ-REV-06')],
    },
    async ({ productPage, registeredUser, signInAs }) => {
      await signInAs(registeredUser.credentials.email, registeredUser.credentials.password);
      await productPage.openProduct(PRODUCTS.reviewTarget.slug);

      const before = await productPage.reviews.count();

      expect(
        await productPage.submitReview({
          rating: 4,
          title: 'Une acoustique de référence',
          body: 'Le grain est là dès les premières minutes, et la projection ne faiblit pas.',
        }),
      ).toBe('success');

      // `router.refresh()` re-renders the block from the server, so the new
      // review and the aggregates it moved arrive together.
      await expect(productPage.reviews).toHaveCount(before + 1);
      await expect(productPage.reviews.first()).toContainText('Une acoustique de référence');
    },
  );

  test(
    'un second avis du même client sur le même produit est refusé',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-456', 'Avis en doublon depuis la fiche'), covers('REQ-REV-06')],
    },
    async ({ productPage, registeredUser, signInAs }) => {
      await signInAs(registeredUser.credentials.email, registeredUser.credentials.password);
      await productPage.openProduct(PRODUCTS.reviewTarget.slug);

      const payload = {
        rating: 5,
        title: 'Rien à redire après un mois',
        body: 'Je la reprendrais sans hésiter, la finition tient parfaitement dans le temps.',
      };

      expect(await productPage.submitReview(payload)).toBe('success');
      expect(await productPage.submitReview(payload)).toBe('error');
      await expect(productPage.reviewStatus).toContainText('déjà publié');
    },
  );
});
