import { describe, expect, it } from 'vitest';

import {
  THEME_BOOTSTRAP_SCRIPT,
  THEME_CYCLE,
  THEME_STORAGE_KEY,
  nextTheme,
} from '@/lib/theme';

/**
 * The button's cycle is the only thing that makes "follow the device"
 * reachable again from the interface: cut down to two states, a visitor who
 * clicked once would be locked in until they cleared their storage.
 * REQ-THEME-05 and TC-432 guard it in the browser; these tests hold the rule
 * itself.
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
    // `indexOf` returns -1, so `(-1 + 1) % 3` is 0: a corrupted key, or one
    // written by an earlier version, must not jam the button.
    expect(nextTheme('sepia' as never)).toBe('system');
  });

  it('n’a que trois états, dont « système » en tête', () => {
    expect(THEME_CYCLE).toEqual(['system', 'light', 'dark']);
  });
});

describe('THEME_BOOTSTRAP_SCRIPT', () => {
  it('ne pose l’attribut que pour un choix explicite valide', () => {
    // "Système" is the absence of the attribute: that is what lets
    // `color-scheme: light dark` follow the device without a line of JavaScript.
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
    // The script sits at the top of <head>: an exception here would halt the
    // whole document. Some browsers throw on a mere read.
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
    // The script is injected through dangerouslySetInnerHTML: no `</script>`
    // may be able to break out of it.
    expect(THEME_BOOTSTRAP_SCRIPT).not.toContain('</');
  });
});
