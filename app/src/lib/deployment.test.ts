import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  DEMO_AUTH_SECRET,
  assertDeploymentConfig,
  authSecret,
  deploymentWarnings,
  isProductionDeployment,
  isTestMode,
} from '@/lib/deployment';

/**
 * Le discriminant est `E2E_TEST_MODE`, pas `NODE_ENV` : le `webServer` de
 * Playwright lance l'application en mode production, donc une garde adossée à
 * NODE_ENV prendrait la suite entière pour un déploiement réel. La règle est
 * fail-closed — un environnement non reconnu vaut production — et ces tests
 * visent d'abord ce point-là, parce qu'un relâchement y est invisible à la
 * relecture et publiquement exploitable.
 *
 * `vi.stubEnv` plutôt qu'une écriture directe : NODE_ENV est typé en lecture
 * seule, et la restauration est automatique.
 */

afterEach(() => vi.unstubAllEnvs());

function environnement(vars: Record<string, string | undefined>): void {
  for (const [cle, valeur] of Object.entries(vars)) vi.stubEnv(cle, valeur);
}

describe('isTestMode', () => {
  it('n’accepte que la valeur exacte « 1 »', () => {
    environnement({ E2E_TEST_MODE: '1' });
    expect(isTestMode()).toBe(true);

    environnement({ E2E_TEST_MODE: 'true' });
    expect(isTestMode()).toBe(false);

    environnement({ E2E_TEST_MODE: undefined });
    expect(isTestMode()).toBe(false);
  });
});

describe('isProductionDeployment', () => {
  it('tient le serveur de la suite pour un déploiement de test', () => {
    // C'est exactement la configuration du webServer Playwright : production
    // *et* E2E_TEST_MODE. La confondre avec une production casserait la suite.
    environnement({ NODE_ENV: 'production', E2E_TEST_MODE: '1' });
    expect(isProductionDeployment()).toBe(false);
  });

  it('reconnaît une production quand le marqueur de test est absent', () => {
    environnement({ NODE_ENV: 'production', E2E_TEST_MODE: undefined });
    expect(isProductionDeployment()).toBe(true);
  });

  it('ne tient pas le développement pour une production', () => {
    environnement({ NODE_ENV: 'development', E2E_TEST_MODE: undefined });
    expect(isProductionDeployment()).toBe(false);
  });
});

describe('authSecret', () => {
  it('renvoie le secret de démonstration hors production', () => {
    environnement({ NODE_ENV: 'development', AUTH_SECRET: undefined });
    expect(authSecret()).toBe(DEMO_AUTH_SECRET);
  });

  it('renvoie le secret configuré, élagué', () => {
    environnement({ NODE_ENV: 'production', E2E_TEST_MODE: undefined, AUTH_SECRET: '  s3cr3t  ' });
    expect(authSecret()).toBe('s3cr3t');
  });

  it('refuse un secret absent en production', () => {
    environnement({ NODE_ENV: 'production', E2E_TEST_MODE: undefined, AUTH_SECRET: undefined });
    expect(() => authSecret()).toThrow(/absent/);
  });

  it('refuse la valeur de démonstration en production', () => {
    // Elle est publiée dans ce dépôt : l'accepter laisserait n'importe qui
    // forger une session pour n'importe quel compte.
    environnement({
      NODE_ENV: 'production',
      E2E_TEST_MODE: undefined,
      AUTH_SECRET: DEMO_AUTH_SECRET,
    });
    expect(() => authSecret()).toThrow(/démonstration/);
  });

  it('refuse un secret vide ou blanc en production', () => {
    environnement({ NODE_ENV: 'production', E2E_TEST_MODE: undefined, AUTH_SECRET: '   ' });
    expect(() => authSecret()).toThrow(/absent/);
  });

  it('laisse passer la valeur de démonstration sous la suite', () => {
    environnement({ NODE_ENV: 'production', E2E_TEST_MODE: '1', AUTH_SECRET: DEMO_AUTH_SECRET });
    expect(authSecret()).toBe(DEMO_AUTH_SECRET);
  });
});

describe('deploymentWarnings', () => {
  it('ne dit rien d’une configuration ordinaire', () => {
    environnement({ E2E_TEST_MODE: undefined, SEED_BUGS: undefined });
    expect(deploymentWarnings()).toEqual([]);
  });

  it('signale les endpoints de test ouverts', () => {
    environnement({ E2E_TEST_MODE: '1', SEED_BUGS: undefined });
    expect(deploymentWarnings()).toHaveLength(1);
    expect(deploymentWarnings()[0]).toMatch(/E2E_TEST_MODE=1/);
  });

  it('signale les défauts délibérés', () => {
    environnement({ E2E_TEST_MODE: undefined, SEED_BUGS: '1' });
    expect(deploymentWarnings()[0]).toMatch(/SEED_BUGS=1/);
  });

  it('cumule les deux avertissements', () => {
    environnement({ E2E_TEST_MODE: '1', SEED_BUGS: '1' });
    expect(deploymentWarnings()).toHaveLength(2);
  });
});

describe('assertDeploymentConfig', () => {
  it('laisse démarrer une production correctement configurée', () => {
    environnement({ NODE_ENV: 'production', E2E_TEST_MODE: undefined, AUTH_SECRET: 'z'.repeat(48) });
    expect(() => assertDeploymentConfig()).not.toThrow();
  });

  it('fait échouer le démarrage plutôt que la première requête', () => {
    environnement({ NODE_ENV: 'production', E2E_TEST_MODE: undefined, AUTH_SECRET: undefined });
    expect(() => assertDeploymentConfig()).toThrow();
  });
});
