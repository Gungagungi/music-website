import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Tests unitaires de l'arithmétique monétaire — et d'elle seule.
 *
 * La suite Playwright éprouve l'application par HTTP et par l'interface ; elle
 * ne peut pas dire *quelle* règle d'arrondi a produit un total faux, ni couvrir
 * les cas limites d'un calcul sans passer par un panier réel. C'est le seul
 * endroit du dépôt où un test parle directement à une fonction.
 *
 * Le périmètre est étroit à dessein : `include` ne ramasse que `src/lib`, et
 * seules les fonctions pures y sont testées. Tout ce qui touche la base reste
 * couvert par la suite d'API, qui l'éprouve contre un vrai PostgreSQL plutôt
 * que contre un doublure.
 */
export default defineConfig({
  test: {
    include: ['src/lib/**/*.test.ts'],
    environment: 'node',
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
