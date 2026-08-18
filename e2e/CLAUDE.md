# CLAUDE.md

Ce fichier complète le `CLAUDE.md` de la racine ; il n'est chargé que lorsque Claude Code travaille sur des fichiers de ce dossier.

## Architecture de la suite E2E

**Topologie par projets** (`e2e/playwright.config.ts`). Deux axes : *quoi* (api, ui, a11y, visual) et *où* (chromium/firefox/webkit/mobile-chrome). `setup-db` réinitialise la base, `setup-auth` en dépend et produit un `storageState` authentifié ; tous les autres projets dépendent de l'un des deux, donc aucune spec ne court après le reset. `mobile-chrome` ne prend que `@smoke` : un viewport mobile est un risque de mise en page, pas de logique.

**Isolation.** Le reset est fait **une fois par run**, jamais par test — la base est globale au processus, un reset depuis un worker effacerait les données d'un autre. La stratégie inverse est appliquée : chaque spec crée ses propres données via les fixtures `registeredUser` (compte unique) et `cartWith` (panier arrangé par API puis remis au navigateur), ce qui rend `fullyParallel` sûr. Le setup recharge aussi le stock de trois produits (`STOCK_TOP_UP`) car les specs de commande le consomment réellement.

**Page objects** (`e2e/pages/`) : locators et actions, **aucune assertion**. Les attentes restent dans les specs, sinon chaque page object gagne une méthode par assertion et les messages d'échec pointent trois fichiers plus loin. `BasePage.open()` attend l'hydratation avant de rendre la main.

**Matchers métier** (`e2e/utils/matchers.ts`) : `toShowPrice(cents)`, `toBeSortedByPrice('asc')`. Point non négociable — un matcher créé via `expect.extend` **n'hérite pas** de l'auto-retry des assertions natives ; la scrutation est donc déléguée à `toPass`, et la condition d'arrêt tient compte de `this.isNot`. Sans cela l'assertion lit le montant d'avant re-rendu et passe au retry, ce qui se présente comme un test instable alors que c'est un défaut du framework.

**`e2e/data/seed.ts` est le contrat** entre l'app et la suite : miroir des graines (utilisateurs, coupons, produits choisis pour une propriété précise, `CATALOG_TOTAL_PRODUCTS`, `RULES`). Toute modification de `app/src/data/` ou de `lib/money.ts` doit y être répercutée. Ce qui doit être unique est construit à l'exécution (`e2e/data/builders/`, faker).

**`e2e/config/env.ts` est le seul point de lecture de `process.env`** côté suite, avec des valeurs par défaut telles que `npx playwright test` fonctionne sans configuration.

**Tags et traçabilité** (`e2e/utils/tags.ts`). `@smoke` garde chaque push, `@regression` tourne la nuit, `@known-bug` marque les specs qui n'échouent que sous `SEED_BUGS=1`. Les annotations `testCase('TC-xxx')`, `covers('REQ-xxx')`, `knownBug('BUG-xxx')` relient une spec à sa documentation. Reprendre ce format pour toute nouvelle spec.

Le générateur vérifie **les deux sens** et échoue sur l'un comme sur l'autre : une exigence de `docs/requirements.md` que rien ne couvre, et une exigence citée par `covers()` qui n'est déclarée nulle part. Une exigence vérifiée hors de la suite se déclare dans sa ligne de `requirements.md` par « verified by `chemin` » — c'est le cas de `REQ-DATA-05`, qui demande de redémarrer le serveur.

**Sélecteurs** : `testIdAttribute: 'data-testid'`, locale `fr-FR`, timezone `Europe/Paris`. Privilégier les rôles ARIA, puis `data-testid`.
