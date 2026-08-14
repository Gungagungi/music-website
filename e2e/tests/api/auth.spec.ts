import { expect, test } from '@/fixtures/api-fixtures';
import { apiErrorSchema, authResponseSchema, publicUserSchema } from '@/api/schemas';
import { UserBuilder } from '@/data/builders/UserBuilder';
import { SEEDED_USERS } from '@/data/seed';
import { TAGS, covers, testCase } from '@/utils/tags';

test.describe('API — authentification', () => {
  test(
    'POST /api/auth/register crée un compte et retourne un jeton exploitable',
    {
      tag: [TAGS.smoke, TAGS.contract],
      annotation: [testCase('TC-200', 'Inscription nominale'), covers('REQ-AUTH-01')],
    },
    async ({ api }) => {
      const credentials = new UserBuilder().build();

      const body = await api.expectOk(await api.register(credentials), authResponseSchema, 201);

      expect(body.user.email).toBe(credentials.email.toLowerCase());
      expect(body.user).not.toHaveProperty('passwordHash');

      // The token must actually work, not merely be present.
      const me = await api.withToken(body.token).me();
      const profile = await api.expectOk(me, publicUserSchema);
      expect(profile.id).toBe(body.user.id);
    },
  );

  test(
    'POST /api/auth/register refuse une adresse déjà utilisée',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-201', 'Inscription en doublon'), covers('REQ-AUTH-02')],
    },
    async ({ api }) => {
      const credentials = new UserBuilder().withEmail(SEEDED_USERS.secondary.email).build();

      const body = await api.expectOk(await api.register(credentials), apiErrorSchema, 409);
      expect(body.error.code).toBe('CONFLICT');
    },
  );

  test(
    'POST /api/auth/login ne distingue pas compte inconnu et mot de passe erroné',
    {
      tag: [TAGS.security, TAGS.regression],
      annotation: [testCase('TC-202', 'Non-divulgation des comptes'), covers('REQ-SEC-01')],
    },
    async ({ api }) => {
      const unknownAccount = await api.login({
        email: 'aucun.compte@fretline.test',
        password: 'PeuImporte1!',
      });
      const wrongPassword = await api.login({
        email: SEEDED_USERS.withOrders.email,
        password: 'MauvaisMotDePasse1',
      });

      const unknownBody = await api.expectOk(unknownAccount, apiErrorSchema, 401);
      const wrongBody = await api.expectOk(wrongPassword, apiErrorSchema, 401);

      // Identical code *and* message: any difference here is an account
      // enumeration oracle.
      expect(unknownBody.error.code).toBe(wrongBody.error.code);
      expect(unknownBody.error.message).toBe(wrongBody.error.message);
    },
  );

  test(
    'GET /api/auth/me exige une authentification',
    {
      tag: [TAGS.security, TAGS.smoke],
      annotation: [testCase('TC-203', 'Accès profil sans jeton'), covers('REQ-SEC-02')],
    },
    async ({ api }) => {
      const body = await api.expectOk(await api.me(), apiErrorSchema, 401);
      expect(body.error.code).toBe('UNAUTHORIZED');
    },
  );

  test(
    'la fixture registeredUser fournit un compte authentifié isolé',
    {
      tag: [TAGS.regression],
      annotation: [testCase('TC-204', 'Isolation des comptes de test')],
    },
    async ({ authedApi, authedUser }) => {
      const profile = await authedApi.expectOk(await authedApi.me(), publicUserSchema);

      expect(profile.id).toBe(authedUser.userId);
      expect(profile.email).toBe(authedUser.credentials.email.toLowerCase());
    },
  );
});
