# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Aperçu

**Fretline** — boutique fictive de guitares et basses, doublée d'un framework d'automatisation QA complet. Le site n'est pas la finalité : il existe pour donner à la suite de tests une application réaliste à éprouver (facettes, tri, pagination, panier, coupons, commande, authentification). Tout choix d'architecture côté application est donc arbitré par la testabilité et le déterminisme.

Monorepo npm workspaces, deux paquets :

- `app/` — `@fretline/app` : Next.js 16 (App Router, React 19, Tailwind 4), PostgreSQL 17 via Drizzle, API REST.
- `e2e/` — `@fretline/e2e` : Playwright (UI multi-navigateurs, contrats API, accessibilité axe-core, régression visuelle).
- `perf/` — scripts k6 (hors workspaces, exécutés depuis la racine).

Node ≥ 20.9 (`.nvmrc` : 20).

## Commandes

Depuis la racine (les scripts délèguent aux workspaces) :

```bash
npm install                # installe les deux workspaces
npm run db:setup           # .env, PostgreSQL dans Docker, migrations, graines
npm run dev                # Next.js en dev sur :3000
npm run build              # build de production (requis avant les tests)
npm run lint               # eslint app + e2e
npm run typecheck          # tsc --noEmit sur les deux workspaces
npm test                   # suite Playwright complète (tous les projets)
npm run test:smoke         # --grep @smoke
npm run test:api           # projet api seul (aucun navigateur lancé, ~10 s)
npm run test:a11y          # scans axe-core
npm run test:visual        # comparaison aux baselines — échoue hors container CI (voir plus bas)
npm run report             # ouvre le rapport HTML
npm run perf:smoke         # k6, 10 VU / 30 s (k6 doit être installé)
npm run perf:load          # k6, montée en charge
```

Base de données (Docker requis — voir ADR-005) :

```bash
npm run db:up              # PostgreSQL seul, docker-compose.dev.yml
npm run db:migrate         # applique le prélude puis les migrations
npm run db:seed            # graines, idempotent
npm run db:reset           # TRUNCATE + rejeu — même chemin que POST /api/test/reset
npm run db:purge           # applique la politique de rétention des paniers
npm run db:generate        # drizzle-kit generate, après modification du schéma
npm run db:nuke            # supprime le volume
```

Pile de production, depuis un poste qui a déjà un `.env` de développement :

```bash
npm run prod:env -- --domain=:80   # .env.production, secrets tirés au hasard
npm run prod:up                    # build de l'image + docker compose up
npm run prod:verifier              # /api/test/* doivent répondre 404
npm run prod:persistance           # REQ-DATA-05 : commande, arrêt, relecture
npm run prod:logs / prod:down / prod:nuke
```

Depuis `e2e/` pour un ciblage fin :

```bash
npx playwright test tests/ui/panier.spec.ts --project=chromium
npx playwright test --project=chromium -g "modifier la quantité"
npx playwright test --project=chromium --headed        # ou --debug
npx playwright test --project=firefox --grep @smoke
npm run test:bugs                                      # SEED_BUGS=1, --grep @known-bug
npx playwright test --project=visual --update-snapshots
```

Le `webServer` de Playwright lance `npm run start -w app` (build de production, **pas** le serveur de dev, dont les délais de compilation rendent la première navigation imprévisible) et réutilise un serveur déjà présent hors CI. Il faut donc avoir buildé au préalable, et avoir une base joignable via `DATABASE_URL`. Il injecte `E2E_TEST_MODE=1` et `TEST_API_TOKEN`.

Un serveur `next-server` oublié sur le port 3000 est réutilisé avec l'ancien `TEST_API_TOKEN` et produit des 403 qui ne désignent rien. `pkill -f "next start"` ne les attrape pas : viser `next-server`.

Régénérer le catalogue après modification de la table source : `node app/scripts/generate-catalog.mjs`.

## Architecture de l'application

**PostgreSQL partout** (`app/src/db/`, `app/src/lib/repositories/`). Schéma Drizzle, driver `pg`, la même base en développement, en CI, dans la suite et en production — voir ADR-005, qui remplace ADR-001. Un seul chemin de code : la suite éprouve ce qui est déployé. `POST /api/test/reset` fait `TRUNCATE … RESTART IDENTITY CASCADE` puis rejoue les graines, en une transaction (~90 ms après le premier appel, les hashs scrypt étant mémoïsés par processus).

Trois pièges à connaître avant de toucher à cette couche :

- **Le pool est paresseux et épinglé sur `globalThis`** (`app/src/db/client.ts`), exposé par un `Proxy`. Importer `db` ne doit ni ouvrir de connexion ni lire `DATABASE_URL` : `next build` traverse ce module par chaque route handler, et ni le build ni le job CI `qualite` n'ont de base en face. L'épinglage a la même raison que l'ancien `__fretlineDb` : Next recharge les modules en dev, un pool par graphe épuiserait `max_connections`.
- **`TRUNCATE … RESTART IDENTITY` ne remet pas à zéro `user_id_seq` ni `order_ref_seq`** : ces séquences n'appartiennent à aucune colonne identity. Le reset les repositionne explicitement (`setval`), et c'est ce qui garantit `USR-0004` et `FRT-000001` aux specs.
- **`app/drizzle/prelude.sql` vit hors du journal drizzle-kit.** Il installe `unaccent`, `pg_trgm` et l'enveloppe `IMMUTABLE` dont dépend la colonne générée `search_text`. Le mettre en tête d'une migration ne survivrait pas à la prochaine régénération, silencieusement, jusqu'à ce qu'une base neuve refuse de se construire.

**Commandes de base et image de production.** Les entrées en ligne de commande sont dans `app/src/db/cli/` et **ne font rien à l'import** ; les modules qui travaillent (`migrate.ts`, `seed.ts`, `bootstrap.ts`) n'ont aucun effet de bord. Ce n'est pas de la propreté : `scripts/build-db-cli.mjs` les bundle avec esbuild pour l'image, et un garde `import.meta.url === process.argv[1]` devient vrai partout à la fois dans un bundle — `bootstrap` lançait les migrations trois fois en parallèle sur le même pool. Voir `app/src/db/cli/run.ts`.

**Montants en centimes entiers, partout** (`app/src/lib/money.ts`). Les prix affichés sont TTC (convention française) : la TVA est *extraite* du total, jamais ajoutée par-dessus. Arrondi au demi supérieur en valeur absolue. Ne jamais introduire de flottant dans un calcul monétaire, ni côté app ni côté test.

**Enveloppe d'erreur unique** (`app/src/lib/api.ts`). Toute erreur renvoie `{ error: { code, message, details? } }`, le code HTTP étant dérivé du `ApiErrorCode` via `STATUS_BY_CODE`. C'est ce qui permet aux specs d'asserter `body.error.code === 'OUT_OF_STOCK'` au lieu de matcher une chaîne. Les helpers `parseBody`/`parseQuery` (Zod) distinguent délibérément JSON malformé (`INVALID_JSON`, 400) et violation de schéma (`VALIDATION_ERROR`, 422).

**Endpoints de test** (`app/src/app/api/test/{reset,seed,state,purge}`). Doublement gardés : invisibles si `E2E_TEST_MODE !== '1'` (répondent 404), puis refusés sans en-tête `x-test-token` valide. `seed` arrange des préconditions (comptes, niveaux de stock, âge d'un panier), `state` donne accès à l'état serveur qu'aucune UI n'expose, `purge` déclenche la politique de rétention — la vraie, celle que le service `purge` exécute en production.

**Garde de déploiement** (`app/src/lib/deployment.ts`, `app/src/instrumentation.ts`). Ne **jamais** ajouter `NODE_ENV !== 'production'` à `testEndpointsEnabled()` : le `webServer` de Playwright lance `npm run start -w app`, donc en mode production, et cette garde casserait la suite entière. Le discriminant est `E2E_TEST_MODE`, et il est *fail-closed* — un environnement non reconnu est traité comme une production. `AUTH_SECRET` est obligatoire hors dev et hors suite, et la valeur de démonstration, publiée dans ce dépôt, est refusée explicitement.

**Rétention des paniers** (`app/src/lib/retention.ts`). La règle est que la rétention suit l'atteignabilité : un panier invité n'est adressé que par le cookie `fretline_cart`, donc sa fenêtre est celle du cookie et non un nombre choisi séparément. Vide 24 h, invité garni 30 jours, rattaché à un compte **exempté** de ces deux règles et balayé après un an de dormance. Le panier n'est matérialisé qu'au premier ajout : `resolveCart()` ne crée jamais, seul `POST /api/cart/items` passe par `resolveCartForWrite()`.

**Authentification** (`app/src/lib/auth.ts`). JWT `jose`, secret de démo en dur en développement et dans la suite. Le porteur est résolu depuis le cookie `fretline_token` **ou** un en-tête `Authorization: Bearer` — c'est ce qui évite à la suite API de simuler un cookie jar. Même dualité pour le panier : cookie `fretline_cart` ou en-tête `x-cart-id`.

**Catalogue déterministe.** `app/scripts/generate-catalog.mjs` dérive chaque attribut « pseudo-aléatoire » (note, stock, date) d'un hash du SKU via un PRNG graine (xmur3 + mulberry32) : régénérer ne produit aucun diff sans changement de la table source. Les visuels produit sont des SVG générés à la volée (`app/src/app/images/product/[slug]/route.ts`), sans texte — pas d'hôte d'images tiers, suite exécutable hors ligne, baselines stables.

**Tri avant pagination** (`app/src/lib/repositories/products.ts`). Le tri s'applique à l'ensemble du résultat *puis* découpe la page, avec départage sur `id` pour rendre l'ordre total. L'inverse produit des pages ordonnées entre elles mais globalement fausses — c'est précisément l'un des défauts semés. Le total de pagination vient d'un `count(*) OVER ()` dans la même requête ; il faut un `COUNT` de repli quand la page ne ramène aucune ligne, sinon une page hors bornes renvoie `total: 0`.

**Ne pas « améliorer » en traduisant.** La recherche reste une correspondance de sous-chaîne sur index `pg_trgm`, pas un `tsvector` : la racinisation et les frontières de mots casseraient `strat mn` et `basse 5`. Les agrégats d'avis restent incrémentaux, pas recalculés : les `rating`/`review_count` des graines décrivent un historique que les cinq avis semés ne contiennent pas.

**Marqueur d'hydratation** (`app/src/components/HydrationMarker.tsx`). Pose `data-hydrated="true"` sur `<html>` après le premier effet. Inerte en production, c'est le signal d'attente explicite dont dépend `BasePage.waitForHydration()`.

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

## Défauts semés — `SEED_BUGS=1`

Trois défauts délibérés, chacun documenté en commentaire à son emplacement, activés seulement par la variable :

| Défaut | Emplacement | Effet |
| --- | --- | --- |
| BUG-001 | `app/src/lib/cart.ts` | Remise en pourcentage tronquée à l'euro entier |
| BUG-002 | `app/src/lib/repositories/products.ts` | Tri appliqué **après** la pagination |
| BUG-003 | `app/src/components/Footer.tsx` + `CheckoutForm.tsx` | Libellé de champ manquant (a11y) |

Le défaut du composant client passe par `NEXT_PUBLIC_SEED_BUGS` : il est figé **au build**, donc tester ces défauts impose de rebuilder avec la variable, pas seulement de relancer le serveur. Le job CI `demo-defauts` fait exactement cela et n'est vert **que si la suite échoue** sur le build bogué — la détection est ainsi une vraie garde sur la couverture.

## Régression visuelle — règle à ne pas contourner

Les baselines (`e2e/tests/visual/__screenshots__/`) sont capturées dans **le container CI** (`mcr.microsoft.com/playwright:<version>-noble`) et sur un seul moteur. Les métriques de police diffèrent assez d'une distribution à l'autre pour décaler chaque mot de quelques pixels, soit ~6 % de diff sans aucune régression réelle. Donc :

- `npm run test:visual` **échouera** sur un poste de développement. C'est attendu.
- Ne jamais relever `maxDiffPixelRatio` (0,01) pour absorber l'écart : cela rendrait la suite aveugle aux vraies régressions.
- Après un changement d'interface assumé : Actions → *Régénérer les baselines visuelles* → choisir la branche. Le workflow régénère dans le container et recommite. Relire le diff des PNG.
- `snapshotPathTemplate` épingle le nom de plateforme : une capture macOS ne matchera jamais une capture Linux.

## CI

- **`ci.yml`** — garde chaque push/PR. `qualite` (lint, typecheck, build) publie `app/.next` en artifact ; tous les jobs de test le téléchargent, l'application n'est buildée qu'une fois. Chromium porte la régression complète en 3 shards, Firefox et WebKit seulement `@smoke` (ils ont déjà attrapé une course d'hydratation et une navigation avortée). Chaque job nomme son propre blob (`PLAYWRIGHT_BLOB_OUTPUT_FILE`), sinon plusieurs `report.zip` s'écrasent silencieusement à la fusion.
- **`nightly.yml`** — le run exhaustif : régression complète sur les trois moteurs, vrai test de charge.
- **`baselines-visuelles.yml`** — régénération manuelle des captures (voir ci-dessus).
- **`pages.yml`** — publie le rapport sur https://gungagungi.github.io/music-website/, tous les jours à 02:30 UTC et à la demande. Il relance sa propre suite au lieu de réutiliser le rapport du nightly : dépendre d'un artifact produit ailleurs ferait échouer la publication chaque fois que le nightly échoue, alors qu'un rapport rouge est exactement ce qu'on veut publier.

Le job **`deploiement`** de `ci.yml` construit l'image et monte la pile complète à chaque push, puis lance `verifier-deploiement.sh` et `verifier-persistance.sh`. C'est le seul endroit où le Dockerfile, le compose et le Caddyfile sont exécutés avant une mise en ligne réelle — sans lui, ils pourrissent en silence et on l'apprend un soir de déploiement. Il porte aussi `REQ-DATA-05`, que la suite Playwright ne peut pas couvrir.

Chaque job de test a besoin d'une base : un service `postgres`, puis l'action composite `.github/actions/preparer-base` (attente, migrations, graines).

Contraintes CI à connaître avant de toucher aux workflows :

- Un job **avec** `container:` joint la base par **le nom du service** (`postgres:5432`) ; un job sur le runner hôte doit publier le port et passer par `localhost`. `DATABASE_URL` diffère donc d'un job à l'autre — c'est la confusion la plus coûteuse de ce fichier.
- `output: 'standalone'` est conditionné à `BUILD_STANDALONE=1`, posé par le seul Dockerfile. Un build qui le porte ne peut plus être servi par `next start`, dont dépendent le `webServer` de Playwright et tous les jobs de test.

- Le tag du container Playwright doit correspondre exactement à `@playwright/test` dans `e2e/package.json` (binaires navigateurs liés à la version). Il n'est pas templatable depuis `env` : `container.image` est évalué avant l'existence du contexte `env`.
- `HOME: /root` est nécessaire dans les jobs conteneurisés : Firefox refuse de démarrer en root si `$HOME` (par défaut `/github/home`, propriété de `pwuser`) appartient à un autre utilisateur. Chromium et WebKit s'en moquent.
- La fusion des rapports exige `npx playwright merge-reports -c merge.config.ts` : les blobs viennent de deux `testDir` différents (checkout container `/__w/...` vs hôte `/home/runner/work/...`) et `merge-reports` refuse l'ambiguïté sans config.

## Conventions

- Alias `@/*` : vers `app/src/*` dans `app`, vers `e2e/*` dans `e2e`. Les deux workspaces sont en `strict`, et `e2e` ajoute `noUncheckedIndexedAccess` et `noUnusedLocals/Parameters`.
- Imports de type explicites (`consistent-type-imports`, erreur dans `e2e`).
- Français pour l'interface, les commentaires, les messages d'erreur API, les noms de tests et les messages de commit (`feat|fix|test|ci(scope): …`). Identifiants de code en anglais.
- Les commentaires du dépôt expliquent *pourquoi* une décision a été prise, souvent en citant le défaut concret qui l'a motivée. Conserver ce registre plutôt que de paraphraser le code.
- Documentation QA en anglais (`docs/`, `README.md`), tout le reste en français. C'est un arbitrage assumé : le dépôt sert de portfolio, la doc doit être lisible par un recruteur anglophone.
- `docs/traceability-matrix.md` et `docs/test-cases/test-cases.csv` sont **générés** par `npm run trace -w e2e` depuis les annotations `testCase()` / `covers()`. Ne jamais les éditer à la main : le job `qualite` lance `trace:check` et échoue si le committé diverge du code. Toute nouvelle spec doit donc porter ses annotations, et la régénération doit être committée dans le même changement.
- Un identifiant `TC-xxx` couvre **une** vérification. Un cas paramétré donne un identifiant par scénario, sinon la matrice ment (une ligne prétendrait couvrir trois vérifications, et en supprimer une passerait inaperçu).
