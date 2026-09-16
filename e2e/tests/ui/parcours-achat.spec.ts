import { expect, test } from '@/fixtures/test-fixtures';
import { AddressBuilder } from '@/data/builders/AddressBuilder';
import { CATEGORIES, PRODUCTS, RULES } from '@/data/seed';
import { TAGS, covers, testCase } from '@/utils/tags';

/**
 * The purchase journey, end to end, with no arrangement through the API.
 *
 * Every step is already covered one by one — TC-010 for the home page, TC-060
 * and TC-067 for the product page, TC-100 for the cart, TC-120 for checkout —
 * and each of those specs sets up its preconditions through the API, on
 * purpose: a failure there then points at the faulty step and nothing else.
 *
 * That split nevertheless leaves a blind spot, and it is this spec's sole
 * purpose: nothing guaranteed that the cart filled by clicking on the product
 * page is the one checkout charges. The `fretline_cart` cookie set on add, its
 * pick-up by the cart page, then by the order, are three joints no spec went
 * through within a single session.
 *
 * Hence: one test, one session, zero arrangement fixtures, and the price
 * followed from the catalogue card all the way to the confirmation. Fine-grained
 * checks (facets, coupons, field validation) stay with the dedicated specs —
 * adding them here would make a failure ambiguous without covering anything
 * more.
 */
test.describe('Parcours d’achat complet', () => {
  test(
    'un visiteur arrive, choisit un article, l’ajoute au panier et commande',
    {
      tag: [TAGS.smoke, TAGS.critical],
      annotation: [
        testCase('TC-130', 'Parcours d’achat de bout en bout'),
        covers('REQ-ORDER-09'),
      ],
    },
    async ({ page, homePage, catalogPage, productPage, cartPage, checkoutPage, confirmationPage }) => {
      const quantity = 2;

      // 1. Landing on the site.
      await homePage.open();
      await expect(homePage.hero).toBeVisible();
      await expect(homePage.header.cartCount).toHaveText('0');

      // 2. Navigating to a category, through the category bar.
      await homePage.header.openCategory(CATEGORIES.effectPedals.slug);
      await page.waitForURL(`**/c/${CATEGORIES.effectPedals.slug}`);
      await expect(catalogPage.heading).toHaveText(CATEGORIES.effectPedals.label);

      // 3. Opening the product page from its card. The price is read here, on
      // the card, and not taken from the seed data: that is what turns the
      // chain into a continuity check rather than a series of independent
      // assertions against the same constant.
      const card = catalogPage.cardBySlug(PRODUCTS.cheap.slug);
      const unitPriceCents = await card.priceCents();
      await card.open();
      await page.waitForURL(`**/p/${PRODUCTS.cheap.slug}`);

      await expect(productPage.heading).toContainText(PRODUCTS.cheap.name);
      await expect(productPage.price).toShowPrice(unitPriceCents);

      // 4. Adding to the cart, by clicking, with the quantity typed into the form.
      expect(await productPage.addToCart({ quantity })).toBe('success');
      await expect(productPage.header.cartCount).toHaveText(String(quantity));

      // 5. The cart, reached from the header — the joint the previous split did
      // not go through.
      await productPage.header.cartLink.click();
      await page.waitForURL('**/panier');

      await expect(cartPage.lines).toHaveCount(1);
      const line = cartPage.lineBySku(PRODUCTS.cheap.sku);
      await expect(line.quantity).toHaveValue(String(quantity));
      await expect(line.lineTotal).toShowPrice(unitPriceCents * quantity);

      const expectedTotal = unitPriceCents * quantity + RULES.flatShippingCents;
      await expect(cartPage.subtotal).toShowPrice(unitPriceCents * quantity);
      await expect(cartPage.total).toShowPrice(expectedTotal);

      // 6. Checkout, reached through the cart's link.
      await cartPage.proceedToCheckout();
      await expect(checkoutPage.summaryTotal).toShowPrice(expectedTotal);

      const address = new AddressBuilder().build();
      await checkoutPage.completeCheckout({ address, email: 'parcours@fretline.test' });

      // 7. Confirmation: the order does carry the cart built by clicking.
      await expect(confirmationPage.root).toBeVisible();
      await expect(confirmationPage.reference).toHaveText(/^FRT-\d{6}$/);
      await expect(confirmationPage.email).toHaveText('parcours@fretline.test');
      await expect(confirmationPage.total).toShowPrice(expectedTotal);
      await expect(confirmationPage.header.cartCount).toHaveText('0');
    },
  );
});
