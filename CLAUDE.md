# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Aperçu

**Fretline** — boutique fictive de guitares et basses, doublée d'un framework d'automatisation QA complet. Le site n'est pas la finalité : il existe pour donner à la suite de tests une application réaliste à éprouver (facettes, tri, pagination, panier, coupons, commande, authentification). Tout choix d'architecture côté application est donc arbitré par la testabilité et le déterminisme.

## Commandes

Les scripts sont dans `package.json` (racine et workspaces). Ce que leurs noms ne disent pas :

- `npm run build` est requis avant les tests.
- `npm run test:api` ne lance aucun navigateur (~10 s).
- `npm run test:unit` (Vitest, ~2 s) ne lance ni navigateur ni base : c'est le seul endroit du
  dépôt où un test parle directement à une fonction. Périmètre volontairement étroit — `money.ts`
  et les fonctions pures de `cart.ts`. Tout ce qui touche la base reste couvert par la suite d'API,
  contre un vrai PostgreSQL plutôt que contre une doublure.
- `npm run test:mutation` (Stryker, ~45 s) éprouve ces tests-là. Seuil à 100 % sur le périmètre :
  le job CI échoue dès qu'un mutant survit.
- `npm run test:visual` échoue hors container CI (voir plus bas).
- `npm run db:reset` emprunte le même chemin que `POST /api/test/reset` ; `db:generate` après toute modification du schéma.
- `npm run perf:*` exige k6 installé ; `npm run prod:*` exige un `.env` de développement présent.
- Les seuils k6 sont dérivés de `perf/baseline.json`, mesuré sur le runner CI par le workflow
  dédié — ne jamais éditer ce fichier à la main, et ne jamais relever un seuil pour faire passer
  un run : c'est la mesure qu'on refait, pas la borne qu'on déplace.
- Depuis `e2e/` : `npm run test:bugs` = `SEED_BUGS=1`, `--grep @known-bug`.

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

**Montants en centimes entiers, partout** (`app/src/lib/money.ts`). Les prix affichés sont TTC (convention française) : la TVA est *extraite* du total, jamais ajoutée par-dessus. Arrondi au demi supérieur en valeur absolue. Ne jamais introduire de flottant dans un calcul monétaire, ni côté app ni côté test. Cette arithmétique est tenue par des tests de mutation à 100 % : toute modification doit être accompagnée du test qui tuerait le mutant correspondant, sinon `npm run test:mutation` rougit. Deux mutants sont marqués `// Stryker disable next-line` avec la démonstration de leur équivalence — ne pas en ajouter sans la même démonstration, et ne jamais abaisser le seuil pour absorber un survivant.

**Enveloppe d'erreur unique** (`app/src/lib/api.ts`). Toute erreur renvoie `{ error: { code, message, details? } }`, le code HTTP étant dérivé du `ApiErrorCode` via `STATUS_BY_CODE`. C'est ce qui permet aux specs d'asserter `body.error.code === 'OUT_OF_STOCK'` au lieu de matcher une chaîne. Les helpers `parseBody`/`parseQuery` (Zod) distinguent délibérément JSON malformé (`INVALID_JSON`, 400) et violation de schéma (`VALIDATION_ERROR`, 422).

**Endpoints de test** (`app/src/app/api/test/{reset,seed,state,purge}`). Doublement gardés : invisibles si `E2E_TEST_MODE !== '1'` (répondent 404), puis refusés sans en-tête `x-test-token` valide. `seed` arrange des préconditions (comptes, niveaux de stock, âge d'un panier), `state` donne accès à l'état serveur qu'aucune UI n'expose, `purge` déclenche la politique de rétention — la vraie, celle que le service `purge` exécute en production.

**Garde de déploiement** (`app/src/lib/deployment.ts`, `app/src/instrumentation.ts`). Ne **jamais** ajouter `NODE_ENV !== 'production'` à `testEndpointsEnabled()` : le `webServer` de Playwright lance `npm run start -w app`, donc en mode production, et cette garde casserait la suite entière. Le discriminant est `E2E_TEST_MODE`, et il est *fail-closed* — un environnement non reconnu est traité comme une production. `AUTH_SECRET` est obligatoire hors dev et hors suite, et la valeur de démonstration, publiée dans ce dépôt, est refusée explicitement.

**Rétention des paniers** (`app/src/lib/retention.ts`). La règle est que la rétention suit l'atteignabilité : un panier invité n'est adressé que par le cookie `fretline_cart`, donc sa fenêtre est celle du cookie et non un nombre choisi séparément. Vide 24 h, invité garni 30 jours, rattaché à un compte **exempté** de ces deux règles et balayé après un an de dormance. Le panier n'est matérialisé qu'au premier ajout : `resolveCart()` ne crée jamais, seul `POST /api/cart/items` passe par `resolveCartForWrite()`.

**Authentification** (`app/src/lib/auth.ts`). JWT `jose`, secret de démo en dur en développement et dans la suite. Le porteur est résolu depuis le cookie `fretline_token` **ou** un en-tête `Authorization: Bearer` — c'est ce qui évite à la suite API de simuler un cookie jar. Même dualité pour le panier : cookie `fretline_cart` ou en-tête `x-cart-id`.

**Catalogue déterministe.** `app/scripts/generate-catalog.mjs` dérive chaque attribut « pseudo-aléatoire » (note, stock, date) d'un hash du SKU via un PRNG graine (xmur3 + mulberry32) : régénérer ne produit aucun diff sans changement de la table source. Les visuels produit sont des SVG générés à la volée (`app/src/app/images/product/[slug]/route.ts`), sans texte — pas d'hôte d'images tiers, suite exécutable hors ligne, baselines stables.

**Tri avant pagination** (`app/src/lib/repositories/products.ts`). Le tri s'applique à l'ensemble du résultat *puis* découpe la page, avec départage sur `id` pour rendre l'ordre total. L'inverse produit des pages ordonnées entre elles mais globalement fausses — c'est précisément l'un des défauts semés. Le total de pagination vient d'un `count(*) OVER ()` dans la même requête ; il faut un `COUNT` de repli quand la page ne ramène aucune ligne, sinon une page hors bornes renvoie `total: 0`.

**Ne pas « améliorer » en traduisant.** La recherche reste une correspondance de sous-chaîne sur index `pg_trgm`, pas un `tsvector` : la racinisation et les frontières de mots casseraient `strat mn` et `basse 5`. Les agrégats d'avis restent incrémentaux, pas recalculés : les `rating`/`review_count` des graines décrivent un historique que les cinq avis semés ne contiennent pas.

**Mesure d'audience** (`app/src/components/analytics/`, `app/src/lib/analytics.ts`). Matomo auto-hébergé, sans cookie, avec suivi e-commerce — voir ADR-006. Deux règles tiennent l'intégration. Le tracker est **absent dès que `E2E_TEST_MODE=1`**, et la garde est dans le layout, côté serveur : la balise n'existe alors pas dans le HTML servi, donc aucune requête tierce ne vient s'intercaler dans une spec ni décaler une capture comparée au pixel. La suite double la mise en abortant `matomo.js`/`matomo.php` au niveau du contexte, et `TC-425` surveille la garde elle-même. Et `NEXT_PUBLIC_MATOMO_URL` / `NEXT_PUBLIC_MATOMO_SITE_ID` sont **figées au build**, exactement comme `NEXT_PUBLIC_SEED_BUGS` : elles entrent par des arguments du Dockerfile, et les changer impose `up -d --build`, pas un redémarrage. Les montants passent par `enUnitesMonetaires()` — seule frontière du dépôt où un montant quitte les centimes entiers.

**Thème d'affichage** (`app/src/app/globals.css`, `app/src/lib/theme.ts`, `app/src/components/ThemeToggle.tsx`). Les couleurs qui changent avec le thème passent toutes par des tokens sémantiques (`bg-surface`, `text-fg-muted`, `border-line`, `bg-contrast`…) définis en `light-dark()` dans `@theme` : une seule définition par token porte les deux thèmes, et il n'y a aucune variante `dark:` dans les composants. Ce qui reste écrit en palette brute (`ink-*`) l'est parce que le fond est sombre dans les deux thèmes — en-tête, pied de page, texte sur aplat ambre. Le seul aiguillage qui ne porte pas sur une couleur, l'affichage des deux libellés du bouton, repasse par une media query : `light-dark()` n'accepte que des `<color>`.

L'interrupteur est la propriété `color-scheme` de `<html>`, et rien d'autre. Sans attribut `data-theme`, `light dark` laisse le navigateur suivre l'appareil — **la détection automatique ne coûte pas une ligne de JavaScript**, donc elle est juste dès la première peinture, y compris script bloqué. Le choix explicite, lui, est reposé par un `<script>` inline **dans `<head>`** (`THEME_BOOTSTRAP_SCRIPT`) : c'est ce qui évite le sursaut de thème, et c'est aussi pourquoi il n'est pas passé à `next/script` — `afterInteractive` s'exécute après la peinture, `beforeInteractive` jamais (voir `Matomo.tsx`). Le bouton de bascule est sans état React : le thème effectif dépend du stockage local et de l'appareil, deux choses que le serveur ignore, et en faire un état rendu redonnerait soit une divergence d'hydratation, soit le scintillement qu'on vient d'éliminer.

Le contraste du thème sombre est tenu par le scan axe en `colorScheme: 'dark'` (`REQ-A11Y-07`), pas par la relecture : c'est là qu'ont été attrapés l'ambre de marque à 3,37:1 sur l'aplat sombre — d'où un ambre propre au thème sombre — et un encart passé sous le seuil AA. Toute retouche de la palette se revalide par ce scan.

**Marqueur d'hydratation** (`app/src/components/HydrationMarker.tsx`). Pose `data-hydrated="true"` sur `<html>` après le premier effet. Inerte en production, c'est le signal d'attente explicite dont dépend `BasePage.waitForHydration()`.

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

## Conventions

- Français pour l'interface, les commentaires, les messages d'erreur API, les noms de tests et les messages de commit (`feat|fix|test|ci(scope): …`). Identifiants de code en anglais.
- Les commentaires du dépôt expliquent *pourquoi* une décision a été prise, souvent en citant le défaut concret qui l'a motivée. Conserver ce registre plutôt que de paraphraser le code.
- Documentation QA en anglais (`docs/`, `README.md`), tout le reste en français. C'est un arbitrage assumé : le dépôt sert de portfolio, la doc doit être lisible par un recruteur anglophone.
- `docs/api/openapi.json` est **généré** par `npm run openapi -w e2e` depuis `e2e/api/schemas.ts` et la table d'opérations `e2e/api/openapi.ts`. Le sens de dérivation est délibérément l'inverse de l'habitude : les schémas sont la source, la spec en découle. Écrire la spec à la main donnerait deux descriptions de la même API dont une seule est exécutée, et c'est la seconde qui dérive. Le job `qualite` lance `openapi:check`, qui valide le document et échoue si le committé diverge.
- `docs/traceability-matrix.md` et `docs/test-cases/test-cases.csv` sont **générés** par `npm run trace -w e2e` depuis les annotations `testCase()` / `covers()`. Ne jamais les éditer à la main : le job `qualite` lance `trace:check` et échoue si le committé diverge du code. Toute nouvelle spec doit donc porter ses annotations, et la régénération doit être committée dans le même changement.
- Un identifiant `TC-xxx` couvre **une** vérification. Un cas paramétré donne un identifiant par scénario, sinon la matrice ment (une ligne prétendrait couvrir trois vérifications, et en supprimer une passerait inaperçu).
