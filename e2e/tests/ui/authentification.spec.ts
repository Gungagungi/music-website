import { expect, test } from '@/fixtures/test-fixtures';
import { UserBuilder } from '@/data/builders/UserBuilder';
import { SEEDED_USERS } from '@/data/seed';
import { TAGS, covers, testCase } from '@/utils/tags';

test.describe('Authentification', () => {
  test(
    'un visiteur peut créer un compte et arrive sur son espace',
    {
      tag: [TAGS.smoke, TAGS.critical],
      annotation: [testCase('TC-080', 'Inscription depuis l’interface'), covers('REQ-AUTH-01')],
    },
    async ({ registerPage, ordersPage, page }) => {
      const user = new UserBuilder().build();

      await registerPage.open();
      await registerPage.register(user);
      await page.waitForURL('**/compte/commandes');

      await expect(ordersPage.accountEmail).toContainText(user.email.toLowerCase());
      await expect(ordersPage.header.accountLink).toContainText(user.firstName);
    },
  );

  test(
    'un mot de passe trop court est refusé champ par champ',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-081', 'Validation du mot de passe'), covers('REQ-AUTH-03')],
    },
    async ({ registerPage }) => {
      const user = new UserBuilder().withTooShortPassword().build();

      await registerPage.open();
      await registerPage.register(user);

      await expect(registerPage.fieldError('password')).toContainText('8 caractères');
      // The message must be attached to its field for assistive technology, not
      // only rendered next to it.
      await expect(registerPage.passwordField).toHaveAttribute('aria-invalid', 'true');
    },
  );

  test(
    'une adresse e-mail malformée est signalée sur le bon champ',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-082', 'Validation de l’e-mail'), covers('REQ-AUTH-03')],
    },
    async ({ registerPage }) => {
      const user = new UserBuilder().withMalformedEmail().build();

      await registerPage.open();
      await registerPage.register(user);

      await expect(registerPage.fieldError('email')).toBeVisible();
      await expect(registerPage.emailField).toHaveAttribute('aria-invalid', 'true');
    },
  );

  test(
    'une adresse déjà utilisée affiche un message de conflit',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-083', 'Inscription en doublon'), covers('REQ-AUTH-02')],
    },
    async ({ registerPage }) => {
      const user = new UserBuilder().withEmail(SEEDED_USERS.secondary.email).build();

      await registerPage.open();
      await registerPage.register(user);

      await expect(registerPage.error).toContainText('existe déjà');
    },
  );

  test(
    'la connexion avec des identifiants valides ouvre l’espace client',
    {
      tag: [TAGS.smoke, TAGS.critical],
      annotation: [testCase('TC-084', 'Connexion nominale'), covers('REQ-AUTH-04')],
    },
    async ({ loginPage, ordersPage, page }) => {
      await loginPage.open();
      await loginPage.login(SEEDED_USERS.withoutOrders.email, SEEDED_USERS.withoutOrders.password);
      await page.waitForURL('**/compte/commandes');

      await expect(ordersPage.accountEmail).toContainText(SEEDED_USERS.withoutOrders.email);
    },
  );

  test(
    'un mot de passe erroné affiche une erreur sans révéler le compte',
    {
      tag: [TAGS.security, TAGS.regression],
      annotation: [testCase('TC-085', 'Connexion refusée'), covers('REQ-SEC-01')],
    },
    async ({ loginPage }) => {
      await loginPage.open();
      await loginPage.login(SEEDED_USERS.withOrders.email, 'MotDePasseIncorrect1');

      await expect(loginPage.error).toContainText('incorrect');
      // Still on the login page: no partial navigation, no leaked hint.
      await expect(loginPage.heading).toBeVisible();
    },
  );

  test(
    'une page protégée redirige vers la connexion puis ramène à la destination',
    {
      tag: [TAGS.regression, TAGS.critical],
      annotation: [testCase('TC-086', 'Redirection après connexion'), covers('REQ-AUTH-05')],
    },
    async ({ ordersPage, loginPage, page }) => {
      await ordersPage.open();
      await page.waitForURL('**/compte/connexion**');
      expect(new URL(page.url()).searchParams.get('redirect')).toBe('/compte/commandes');

      await loginPage.login(SEEDED_USERS.withoutOrders.email, SEEDED_USERS.withoutOrders.password);
      await page.waitForURL('**/compte/commandes');
      await expect(ordersPage.heading).toBeVisible();
    },
  );

  test(
    'la déconnexion réinitialise l’en-tête',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-087', 'Déconnexion'), covers('REQ-AUTH-06')],
    },
    async ({ signInAs, ordersPage, homePage, page }) => {
      await signInAs(SEEDED_USERS.withoutOrders.email, SEEDED_USERS.withoutOrders.password);
      await ordersPage.open();

      await ordersPage.logout.click();
      await page.waitForURL(new RegExp(`${page.url().split('/').slice(0, 3).join('/')}/?$`));

      await expect(homePage.header.loginLink).toBeVisible();
      await expect(homePage.header.accountLink).toBeHidden();
    },
  );

  test(
    'un compte sans historique voit un état vide, pas une page cassée',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-088', 'Historique de commandes vide'), covers('REQ-ACC-01')],
    },
    async ({ registeredUser, signInAs, ordersPage }) => {
      await signInAs(registeredUser.credentials.email, registeredUser.credentials.password);
      await ordersPage.open();

      await expect(ordersPage.emptyState).toBeVisible();
      await expect(ordersPage.orders).toHaveCount(0);
    },
  );
});
