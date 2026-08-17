import coreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

/**
 * eslint-config-next 16 ships native flat configs, so no FlatCompat bridge is
 * needed — the presets are spread directly.
 */
const eslintConfig = [
  ...coreWebVitals,
  ...nextTypescript,
  {
    // `dist/**` contient les commandes de base compilées par `npm run db:build` :
    // du code généré, bundlé avec ses dépendances, qu'il n'y a rien à relire.
    ignores: ['.next/**', 'dist/**', 'node_modules/**', 'next-env.d.ts', 'scripts/**'],
  },
];

export default eslintConfig;
