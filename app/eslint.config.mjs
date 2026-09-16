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
    // `dist/**` holds the database commands compiled by `npm run db:build`:
    // generated code, bundled with its dependencies, with nothing to review.
    ignores: ['.next/**', 'dist/**', 'node_modules/**', 'next-env.d.ts', 'scripts/**', '.stryker-tmp/**', 'reports/**'],
  },
];

export default eslintConfig;
