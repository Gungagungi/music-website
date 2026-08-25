import { describe, expect, it } from 'vitest';

import {
  THEME_BOOTSTRAP_SCRIPT,
  THEME_CYCLE,
  THEME_STORAGE_KEY,
  nextTheme,
} from '@/lib/theme';

/**
 * Le cycle du bouton est la seule chose qui rende « suivre l'appareil »
 * réatteignable depuis l'interface : ramené à deux états, un visiteur ayant
 * cliqué une fois y serait enfermé sans vider son stockage. REQ-THEME-05 et
 * TC-432 le gardent côté navigateur ; ces tests tiennent la règle elle-même.
 */

describe('nextTheme', () => {
  it('cycle système → clair → sombre → système', () => {
    expect(nextTheme('system')).toBe('light');
    expect(nextTheme('light')).toBe('dark');
    expect(nextTheme('dark')).toBe('system');
  });

  it('revient au point de départ en trois clics, jamais en deux', () => {
    expect(nextTheme(nextTheme(nextTheme('system')))).toBe('system');
    expect(nextTheme(nextTheme('system'))).not.toBe('system');
  });

  it('repart de « clair » depuis une valeur stockée inconnue', () => {
    // `indexOf` rend -1, donc `(-1 + 1) % 3` vaut 0 : une clé corrompue ou
    // écrite par une version antérieure ne doit pas bloquer le bouton.
    expect(nextTheme('sepia' as never)).toBe('system');
  });

  it('n’a que trois états, dont « système » en tête', () => {
    expect(THEME_CYCLE).toEqual(['system', 'light', 'dark']);
  });
});

describe('THEME_BOOTSTRAP_SCRIPT', () => {
  it('ne pose l’attribut que pour un choix explicite valide', () => {
    // « Système » est l'absence d'attribut : c'est ce qui laisse `color-scheme:
    // light dark` suivre l'appareil sans une ligne de JavaScript.
    const dataset: Record<string, string> = {};
    const evaluer = (stocke: string | null) => {
      for (const cle of Object.keys(dataset)) delete dataset[cle];
      const localStorage = { getItem: () => stocke };
      const document = { documentElement: { dataset } };
      new Function('localStorage', 'document', THEME_BOOTSTRAP_SCRIPT)(localStorage, document);
      return dataset.theme;
    };

    expect(evaluer('dark')).toBe('dark');
    expect(evaluer('light')).toBe('light');
    expect(evaluer('system')).toBeUndefined();
    expect(evaluer(null)).toBeUndefined();
    expect(evaluer('<script>')).toBeUndefined();
  });

  it('survit à un localStorage qui lève', () => {
    // Le script est en tête de <head> : une exception ici interromprait le
    // document entier. Certains navigateurs lèvent à la simple lecture.
    const localStorage = {
      getItem() {
        throw new Error('accès refusé');
      },
    };
    const document = { documentElement: { dataset: {} as Record<string, string> } };
    expect(() =>
      new Function('localStorage', 'document', THEME_BOOTSTRAP_SCRIPT)(localStorage, document),
    ).not.toThrow();
  });

  it('cite la clé de stockage, échappée pour une insertion inline', () => {
    expect(THEME_BOOTSTRAP_SCRIPT).toContain(JSON.stringify(THEME_STORAGE_KEY));
    // Le script est injecté par dangerouslySetInnerHTML : aucun `</script>` ne
    // doit pouvoir en sortir.
    expect(THEME_BOOTSTRAP_SCRIPT).not.toContain('</');
  });
});
