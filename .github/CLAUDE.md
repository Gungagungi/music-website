# CLAUDE.md

Ce fichier complète le `CLAUDE.md` de la racine ; il n'est chargé que lorsque Claude Code travaille sur des fichiers de ce dossier.

## CI

- **`ci.yml`** — garde chaque push/PR. `qualite` (lint, typecheck, build) publie `app/.next` en artifact ; tous les jobs de test le téléchargent, l'application n'est buildée qu'une fois. Chromium porte la régression complète en 3 shards, Firefox et WebKit seulement `@smoke` (ils ont déjà attrapé une course d'hydratation et une navigation avortée). Chaque job nomme son propre blob (`PLAYWRIGHT_BLOB_OUTPUT_FILE`), sinon plusieurs `report.zip` s'écrasent silencieusement à la fusion.
- **`mutation`** (dans `ci.yml`) — Stryker sur l'arithmétique monétaire, seuil de rupture à 100 %. Il ne dépend d'aucune base : les fonctions visées sont pures. Un mutant survivant fait rougir la CI plutôt que baisser un score que personne ne relit.
- **`nightly.yml`** — le run exhaustif : régression complète sur les trois moteurs, vrai test de charge.
- **`baselines-visuelles.yml`** — régénération manuelle des captures (voir ci-dessus).
- **`pages.yml`** — publie le rapport sur https://gungagungi.github.io/music-website/, tous les jours à 02:30 UTC et à la demande. Il relance sa propre suite au lieu de réutiliser le rapport du nightly : dépendre d'un artifact produit ailleurs ferait échouer la publication chaque fois que le nightly échoue, alors qu'un rapport rouge est exactement ce qu'on veut publier. Corollaire : ses étapes de suite sont en `continue-on-error`, sans quoi le workflow s'arrêterait avant de publier précisément le jour où le rapport aurait le plus à dire.

  Ce job n'a **qu'une base** pour tous ses projets, là où `ci.yml` en donne une par job. Il lance donc `api`, `chromium` et `a11y` en trois exécutions successives et non en une seule : ensemble, les commandes de la suite API consomment du stock réel pendant que les specs UI le comptent (TC-025 attend 11 guitares électriques disponibles, en trouve 8 — reproductible en local en lançant `--project=api` puis en recomptant). Chaque exécution rejoue `setup-db`, donc repart des graines, et nomme son blob pour que la fusion les voie tous les trois.

Le job **`deploiement`** de `ci.yml` construit l'image et monte la pile complète à chaque push, puis lance `verifier-deploiement.sh` et `verifier-persistance.sh`. C'est le seul endroit où le Dockerfile, le compose et le Caddyfile sont exécutés avant une mise en ligne réelle — sans lui, ils pourrissent en silence et on l'apprend un soir de déploiement. Il porte aussi `REQ-DATA-05`, que la suite Playwright ne peut pas couvrir.

Chaque job de test a besoin d'une base : un service `postgres`, puis l'action composite `.github/actions/preparer-base` (attente, migrations, graines).

Contraintes CI à connaître avant de toucher aux workflows :

- Un job **avec** `container:` joint la base par **le nom du service** (`postgres:5432`) ; un job sur le runner hôte doit publier le port et passer par `localhost`. `DATABASE_URL` diffère donc d'un job à l'autre — c'est la confusion la plus coûteuse de ce fichier.
- `output: 'standalone'` est conditionné à `BUILD_STANDALONE=1`, posé par le seul Dockerfile. Un build qui le porte ne peut plus être servi par `next start`, dont dépendent le `webServer` de Playwright et tous les jobs de test.

- Le tag du container Playwright doit correspondre exactement à `@playwright/test` dans `e2e/package.json` (binaires navigateurs liés à la version). Il n'est pas templatable depuis `env` : `container.image` est évalué avant l'existence du contexte `env`.
- `HOME: /root` est nécessaire dans les jobs conteneurisés : Firefox refuse de démarrer en root si `$HOME` (par défaut `/github/home`, propriété de `pwuser`) appartient à un autre utilisateur. Chromium et WebKit s'en moquent.
- La fusion des rapports exige `npx playwright merge-reports -c merge.config.ts` : les blobs viennent de deux `testDir` différents (checkout container `/__w/...` vs hôte `/home/runner/work/...`) et `merge-reports` refuse l'ambiguïté sans config.
