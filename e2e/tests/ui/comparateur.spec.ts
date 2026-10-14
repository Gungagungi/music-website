import { expect, test } from '@/fixtures/test-fixtures';
import { PRODUCTS } from '@/data/seed';
import { TAGS, covers, testCase } from '@/utils/tags';

test.describe('Comparateur', () => {
  test(
    'compare deux produits colonne par colonne',
    {
      tag: [TAGS.smoke],
      annotation: [testCase('TC-140', 'Comparaison de deux produits'), covers('REQ-CMP-01')],
    },
    async ({ comparePage }) => {
      await comparePage.compare([PRODUCTS.inStock.slug, PRODUCTS.leftHanded.slug]);

      await expect(comparePage.table).toBeVisible();
      expect(await comparePage.comparedSlugs()).toEqual([
        PRODUCTS.inStock.slug,
        PRODUCTS.leftHanded.slug,
      ]);
      await expect(comparePage.row('Prix')).toBeVisible();
      await expect(comparePage.row('Disponibilité')).toBeVisible();
    },
  );

  test(
    'la comparaison est plafonnée à trois produits',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-141', 'Limite du comparateur'), covers('REQ-CMP-02')],
    },
    async ({ comparePage }) => {
      await comparePage.compare([
        PRODUCTS.inStock.slug,
        PRODUCTS.leftHanded.slug,
        PRODUCTS.outOfStock.slug,
        PRODUCTS.cheap.slug,
      ]);

      await expect(comparePage.columns).toHaveCount(3);
      expect(await comparePage.comparedSlugs()).not.toContain(PRODUCTS.cheap.slug);
    },
  );

  test(
    'les caractéristiques absentes d’un modèle sont explicitement vides',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-142', 'Caractéristiques hétérogènes'), covers('REQ-CMP-03')],
    },
    async ({ comparePage }) => {
      // A guitar and a pedal share almost no spec keys, so the union of rows
      // must show a placeholder rather than an empty cell.
      await comparePage.compare([PRODUCTS.inStock.slug, PRODUCTS.cheap.slug]);

      await expect(comparePage.table.getByText('—').first()).toBeVisible();
    },
  );

  test(
    'retirer un produit met à jour le comparateur',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-143', 'Retrait du comparateur'), covers('REQ-CMP-01')],
    },
    async ({ comparePage, page }) => {
      await comparePage.compare([PRODUCTS.inStock.slug, PRODUCTS.leftHanded.slug]);

      await comparePage.columns.first().getByTestId('compare-remove').click();
      await page.waitForURL((url) => !url.searchParams.get('refs')?.includes(PRODUCTS.inStock.slug));

      expect(await comparePage.comparedSlugs()).toEqual([PRODUCTS.leftHanded.slug]);
    },
  );

  test(
    'le comparateur vide explique comment y ajouter des produits',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-144', 'Comparateur vide'), covers('REQ-CMP-04')],
    },
    async ({ comparePage }) => {
      await comparePage.open();

      await expect(comparePage.emptyState).toBeVisible();
      await expect(comparePage.table).toBeHidden();
    },
  );

  test(
    'le bouton de la fiche produit alimente le comparateur',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-145', 'Ajout au comparateur depuis la fiche'), covers('REQ-CMP-05')],
    },
    async ({ productPage, comparePage, page }) => {
      await productPage.openProduct(PRODUCTS.inStock.slug);
      await productPage.compareToggle.click();
      await expect(comparePage.bar).toBeVisible();

      await comparePage.openFromBar.click();
      await page.waitForURL('**/comparateur**');

      expect(await comparePage.comparedSlugs()).toEqual([PRODUCTS.inStock.slug]);
    },
  );

  test(
    'la sélection suit le visiteur d’une page à l’autre',
    {
      tag: [TAGS.smoke, TAGS.regression],
      annotation: [testCase('TC-462', 'Persistance de la sélection'), covers('REQ-CMP-05')],
    },
    async ({ productPage, catalogPage, comparePage }) => {
      await productPage.openProduct(PRODUCTS.inStock.slug);
      await productPage.compareToggle.click();
      await expect(comparePage.bar).toHaveAttribute('data-count', '1');

      // The bar is rendered by the root layout from a cookie, so it survives a
      // full navigation — that is the whole reason the selection is not held in
      // component state.
      await catalogPage.openCategory('guitares-electriques');
      expect(await comparePage.selectionCount()).toBe(1);
      await expect(comparePage.barItems).toHaveCount(1);
    },
  );

  test(
    'le même bouton retire ce qu’il a ajouté',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-463', 'Retrait depuis le bouton'), covers('REQ-CMP-05')],
    },
    async ({ productPage, comparePage }) => {
      await productPage.openProduct(PRODUCTS.cheap.slug);

      await productPage.compareToggle.click();
      await expect(productPage.compareToggle).toHaveAttribute('data-selected', 'true');

      // A mis-click is undone where it was made, rather than sending the
      // visitor to the comparator to unpick it.
      await productPage.compareToggle.click();
      await expect(productPage.compareToggle).toHaveAttribute('data-selected', 'false');
      expect(await comparePage.selectionCount()).toBe(0);
    },
  );

  test(
    'un quatrième produit est refusé plutôt que d’en évincer un',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-464', 'Limite atteinte'), covers('REQ-CMP-02')],
    },
    async ({ catalogPage, comparePage, page }) => {
      await catalogPage.openCategory('guitares-electriques');

      const toggles = page.getByTestId('compare-toggle');
      for (let index = 0; index < 3; index += 1) {
        await toggles.nth(index).click();
        await expect(comparePage.bar).toHaveAttribute('data-count', String(index + 1));
      }

      await toggles.nth(3).click();

      // Refused, and said so: silently dropping the oldest would discard
      // something the visitor deliberately picked.
      await expect(page.getByTestId('compare-limit').first()).toBeVisible();
      expect(await comparePage.selectionCount()).toBe(3);
    },
  );

  test(
    '« tout retirer » vide la sélection et fait disparaître la barre',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-465', 'Vidage de la sélection'), covers('REQ-CMP-05')],
    },
    async ({ productPage, comparePage }) => {
      await productPage.openProduct(PRODUCTS.leftHanded.slug);
      await productPage.compareToggle.click();
      await expect(comparePage.bar).toBeVisible();

      await comparePage.clear.click();

      // Absent, not merely empty: an empty bar would occupy screen space on
      // every page to say nothing.
      await expect(comparePage.bar).toHaveCount(0);
    },
  );

  test(
    'un lien de comparaison partagé l’emporte sur la sélection du visiteur',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-466', 'Lien de comparaison partagé'), covers('REQ-CMP-06')],
    },
    async ({ productPage, comparePage }) => {
      await productPage.openProduct(PRODUCTS.inStock.slug);
      await productPage.compareToggle.click();
      await expect(comparePage.bar).toBeVisible();

      // Somebody else's comparison link has to keep meaning what it says, so
      // the URL wins over what this visitor happens to have collected.
      await comparePage.compare([PRODUCTS.cheap.slug, PRODUCTS.leftHanded.slug]);

      expect(await comparePage.comparedSlugs()).toEqual([
        PRODUCTS.cheap.slug,
        PRODUCTS.leftHanded.slug,
      ]);
      // And it leaves that selection alone.
      expect(await comparePage.selectionCount()).toBe(1);
    },
  );
});
