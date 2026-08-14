import { expect, test } from '@/fixtures/api-fixtures';
import { healthSchema } from '@/api/schemas';
import { CATALOG_TOTAL_PRODUCTS } from '@/data/seed';
import { TAGS, covers, testCase } from '@/utils/tags';

test.describe('API — supervision', () => {
  test(
    'GET /api/health renvoie l’état du service et respecte son contrat',
    {
      tag: [TAGS.smoke, TAGS.contract],
      annotation: [testCase('TC-001', 'Sonde de disponibilité'), covers('REQ-OPS-01')],
    },
    async ({ api }) => {
      const response = await api.health();
      const body = await api.expectOk(response, healthSchema);

      expect(body.status).toBe('ok');
      expect(body.products).toBe(CATALOG_TOTAL_PRODUCTS);
      expect(body.testMode, 'La suite exige E2E_TEST_MODE=1.').toBe(true);
    },
  );
});
