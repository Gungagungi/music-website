import { expect, test } from '@/fixtures/test-fixtures';
import { AddressBuilder } from '@/data/builders/AddressBuilder';
import { CATEGORIES, PRODUCTS, RULES } from '@/data/seed';
import { TAGS, covers, testCase } from '@/utils/tags';

/**
 * Le parcours d'achat, d'un bout à l'autre, sans aucun arrangement par l'API.
 *
 * Toutes les étapes sont déjà couvertes une à une — TC-010 pour l'accueil,
 * TC-060 et TC-067 pour la fiche produit, TC-100 pour le panier, TC-120 pour le
 * tunnel — et chacune de ces specs pose ses préconditions par l'API, à dessein :
 * un échec y désigne alors l'étape fautive et rien d'autre.
 *
 * Ce découpage laisse pourtant un angle mort, et c'est le seul objet de cette
 * spec : rien ne garantissait que le panier rempli au clic depuis la fiche
 * produit soit celui que le tunnel encaisse. Le cookie `fretline_cart` posé à
 * l'ajout, sa reprise par la page panier, puis par la commande, sont trois
 * jointures qu'aucune spec ne traversait dans une même session.
 *
 * Donc : un seul test, une seule session, zéro fixture d'arrangement, et le
 * prix suivi de la vignette du catalogue jusqu'à la confirmation. Les
 * vérifications fines (facettes, coupons, validation de champs) restent chez
 * les specs dédiées — les ajouter ici rendrait l'échec ambigu sans rien couvrir
 * de plus.
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

      // 1. Arrivée sur le site.
      await homePage.open();
      await expect(homePage.hero).toBeVisible();
      await expect(homePage.header.cartCount).toHaveText('0');

      // 2. Navigation vers un rayon, par la barre de catégories.
      await homePage.header.openCategory(CATEGORIES.effectPedals.slug);
      await page.waitForURL(`**/c/${CATEGORIES.effectPedals.slug}`);
      await expect(catalogPage.heading).toHaveText(CATEGORIES.effectPedals.label);

      // 3. Ouverture de la fiche depuis la vignette. Le prix est lu ici, sur la
      // carte, et non pris dans les graines : c'est ce qui fait de la chaîne
      // une vérification de continuité plutôt qu'une suite d'assertions
      // indépendantes contre une même constante.
      const card = catalogPage.cardBySlug(PRODUCTS.cheap.slug);
      const unitPriceCents = await card.priceCents();
      await card.open();
      await page.waitForURL(`**/p/${PRODUCTS.cheap.slug}`);

      await expect(productPage.heading).toContainText(PRODUCTS.cheap.name);
      await expect(productPage.price).toShowPrice(unitPriceCents);

      // 4. Ajout au panier, au clic, avec la quantité saisie dans le formulaire.
      expect(await productPage.addToCart({ quantity })).toBe('success');
      await expect(productPage.header.cartCount).toHaveText(String(quantity));

      // 5. Le panier repris depuis l'en-tête — c'est la jointure que le
      // découpage précédent ne traversait pas.
      await productPage.header.cartLink.click();
      await page.waitForURL('**/panier');

      await expect(cartPage.lines).toHaveCount(1);
      const line = cartPage.lineBySku(PRODUCTS.cheap.sku);
      await expect(line.quantity).toHaveValue(String(quantity));
      await expect(line.lineTotal).toShowPrice(unitPriceCents * quantity);

      const expectedTotal = unitPriceCents * quantity + RULES.flatShippingCents;
      await expect(cartPage.subtotal).toShowPrice(unitPriceCents * quantity);
      await expect(cartPage.total).toShowPrice(expectedTotal);

      // 6. Tunnel de commande, atteint par le lien du panier.
      await cartPage.proceedToCheckout();
      await expect(checkoutPage.summaryTotal).toShowPrice(expectedTotal);

      const address = new AddressBuilder().build();
      await checkoutPage.completeCheckout({ address, email: 'parcours@fretline.test' });

      // 7. Confirmation : la commande porte bien le panier constitué au clic.
      await expect(confirmationPage.root).toBeVisible();
      await expect(confirmationPage.reference).toHaveText(/^FRT-\d{6}$/);
      await expect(confirmationPage.email).toHaveText('parcours@fretline.test');
      await expect(confirmationPage.total).toShowPrice(expectedTotal);
      await expect(confirmationPage.header.cartCount).toHaveText('0');
    },
  );
});
