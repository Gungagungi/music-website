# Traceability matrix

<!-- GENERATED FILE — run `npm run trace -w e2e` to refresh. Do not edit by hand. -->

Every row is derived from the `covers()` and `testCase()` annotations carried by the
specs themselves, so this file cannot drift from the suite: CI regenerates it and fails
if the committed copy differs.

## Summary

| | |
| --- | ---: |
| Requirements declared | 176 |
| — covered by this suite | 175 |
| — verified outside it | 1 |
| — not covered | 0 |
| Automated test cases | 257 |
| — Accessibility | 20 |
| — API | 93 |
| — UI | 134 |
| — Visual | 10 |
| Test cases without a requirement | 0 |

## Requirement → test cases

| Requirement | Test cases | Suite | Tags |
| --- | --- | --- | --- |
| `REQ-A11Y-01` | `TC-310`, `TC-311`, `TC-312`, `TC-313`, `TC-314`, `TC-315`, `TC-316`, `TC-317` | Accessibility | @regression @smoke |
| `REQ-A11Y-02` | `TC-318` | Accessibility | @critical @regression |
| `REQ-A11Y-03` | `TC-319`, `TC-352` | Accessibility, UI | @known-bug @regression |
| `REQ-A11Y-04` | `TC-320` | Accessibility | @smoke |
| `REQ-A11Y-05` | `TC-321` | Accessibility | @critical @regression |
| `REQ-A11Y-06` | `TC-322` | Accessibility | @regression |
| `REQ-A11Y-07` | `TC-440`, `TC-441`, `TC-442`, `TC-443`, `TC-444`, `TC-445`, `TC-446` | Accessibility | @regression |
| `REQ-ACC-01` | `TC-088` | UI | @regression |
| `REQ-ALERT-01` | `TC-478`, `TC-479` | API | @critical @regression |
| `REQ-ALERT-02` | `TC-467`, `TC-468`, `TC-472` | UI | @regression @security |
| `REQ-ALERT-03` | `TC-469`, `TC-470`, `TC-471` | UI | @regression @smoke |
| `REQ-API-01` | `TC-210` | API | @contract @critical @smoke |
| `REQ-API-02` | `TC-211` | API | @regression |
| `REQ-API-03` | `TC-212` | API | @regression |
| `REQ-API-04` | `TC-213` | API | @critical @regression |
| `REQ-API-05` | `TC-214` | API | @critical @regression |
| `REQ-API-06` | `TC-215` | API | @regression |
| `REQ-API-07` | `TC-216` | API | @regression |
| `REQ-API-08` | `TC-217` | API | @contract @smoke |
| `REQ-API-09` | `TC-218` | API | @regression |
| `REQ-API-10` | `TC-219` | API | @contract @smoke |
| `REQ-API-11` | `TC-220` | API | @contract @regression |
| `REQ-API-20` | `TC-230` | API | @contract @critical @smoke |
| `REQ-API-21` | `TC-231` | API | @critical @regression |
| `REQ-API-22` | `TC-232`, `TC-233` | API | @regression |
| `REQ-API-23` | `TC-234`, `TC-235` | API | @regression |
| `REQ-API-24` | `TC-236` | API | @regression |
| `REQ-API-25` | `TC-237` | API | @critical @regression |
| `REQ-API-26` | `TC-238` | API | @regression @security |
| `REQ-API-27` | `TC-239` | API | @regression |
| `REQ-API-28` | `TC-240` | API | @regression |
| `REQ-API-30` | `TC-250` | API | @contract @critical @smoke |
| `REQ-API-31` | `TC-251` | API | @critical @regression |
| `REQ-API-32` | `TC-252` | API | @regression |
| `REQ-API-33` | `TC-253` | API | @regression |
| `REQ-API-34` | `TC-254` | API | @contract @regression |
| `REQ-API-35` | `TC-255` | API | @regression |
| `REQ-API-36` | `TC-256` | API | @regression |
| `REQ-API-40` | `TC-270` | API | @critical @smoke |
| `REQ-API-41` | `TC-271`, `TC-276`, `TC-277` | API | @contract @regression |
| `REQ-API-42` | `TC-272` | API | @regression |
| `REQ-API-43` | `TC-273` | API | @critical @regression |
| `REQ-API-44` | `TC-274` | API | @contract @regression |
| `REQ-API-45` | `TC-275` | API | @regression |
| `REQ-API-50` | `TC-281` | API | @contract @regression |
| `REQ-API-51` | `TC-282` | API | @regression |
| `REQ-API-52` | `TC-283` | API | @contract @regression |
| `REQ-API-53` | `TC-284`, `TC-285` | API | @contract @regression |
| `REQ-API-54` | `TC-286` | API | @regression |
| `REQ-API-55` | `TC-287`, `TC-288` | API | @contract @regression |
| `REQ-API-56` | `TC-289` | API | @regression |
| `REQ-API-57` | `TC-473`, `TC-474` | API | @regression @security |
| `REQ-API-58` | `TC-475`, `TC-477` | API | @contract @regression |
| `REQ-API-59` | `TC-476` | API | @regression @security |
| `REQ-API-60` | `TC-290`, `TC-291` | API | @contract @regression |
| `REQ-API-61` | `TC-294`, `TC-295`, `TC-296` | API | @contract @regression |
| `REQ-API-62` | `TC-487` | API | @regression @security |
| `REQ-API-63` | `TC-488`, `TC-489`, `TC-491` | API | @contract @regression |
| `REQ-API-64` | `TC-490` | API | @regression @security |
| `REQ-AUTH-01` | `TC-080`, `TC-200` | UI, API | @contract @critical @smoke |
| `REQ-AUTH-02` | `TC-083`, `TC-201` | UI, API | @regression |
| `REQ-AUTH-03` | `TC-081`, `TC-082` | UI | @regression |
| `REQ-AUTH-04` | `TC-084` | UI | @critical @smoke |
| `REQ-AUTH-05` | `TC-086` | UI | @critical @regression |
| `REQ-AUTH-06` | `TC-087` | UI | @regression |
| `REQ-CART-01` | `TC-011`, `TC-100`, `TC-102` | UI | @critical @smoke |
| `REQ-CART-02` | `TC-067` | UI | @critical @smoke |
| `REQ-CART-03` | `TC-068` | UI | @regression |
| `REQ-CART-04` | `TC-101`, `TC-106` | UI | @critical @regression @smoke |
| `REQ-CART-05` | `TC-069` | UI | @regression |
| `REQ-CART-06` | `TC-103` | UI | @critical @smoke |
| `REQ-CART-07` | `TC-104`, `TC-105` | UI | @critical @regression |
| `REQ-CART-08` | `TC-107` | UI | @critical @regression |
| `REQ-CAT-01` | `TC-020` | UI | @critical @smoke |
| `REQ-CAT-02` | `TC-021`, `TC-022`, `TC-023` | UI | @critical @regression @smoke |
| `REQ-CAT-03` | `TC-024` | UI | @critical @regression |
| `REQ-CAT-04` | `TC-025`, `TC-026`, `TC-027` | UI | @regression @smoke |
| `REQ-CAT-05` | `TC-028` | UI | @regression |
| `REQ-CAT-06` | `TC-029` | UI | @regression |
| `REQ-CAT-07` | `TC-030` | UI | @smoke |
| `REQ-CAT-08` | `TC-031` | UI | @critical @regression |
| `REQ-CAT-09` | `TC-032`, `TC-033` | UI | @regression |
| `REQ-CMP-01` | `TC-140`, `TC-143` | UI | @regression @smoke |
| `REQ-CMP-02` | `TC-141`, `TC-464` | UI | @regression |
| `REQ-CMP-03` | `TC-142` | UI | @regression |
| `REQ-CMP-04` | `TC-144` | UI | @regression |
| `REQ-CMP-05` | `TC-145`, `TC-462`, `TC-463`, `TC-465` | UI | @regression @smoke |
| `REQ-CMP-06` | `TC-466` | UI | @regression |
| `REQ-COUPON-01` | `TC-110`, `TC-350` | UI | @critical @known-bug @smoke |
| `REQ-COUPON-02` | `TC-111` | UI | @regression |
| `REQ-COUPON-03` | `TC-112`, `TC-113` | UI | @regression |
| `REQ-COUPON-04` | `TC-114` | UI | @regression |
| `REQ-COUPON-05` | `TC-115` | UI | @critical @regression |
| `REQ-DATA-01` | `TC-400` | API | @critical @regression |
| `REQ-DATA-02` | `TC-401` | API | @critical @regression |
| `REQ-DATA-03` | `TC-402`, `TC-403` | API | @critical @regression |
| `REQ-DATA-04` | `TC-404` | API | @regression @security |
| `REQ-DATA-10` | `TC-420` | API | @critical @regression |
| `REQ-DATA-11` | `TC-421` | API | @regression |
| `REQ-DATA-12` | `TC-422` | API | @critical @regression |
| `REQ-DATA-13` | `TC-423` | API | @critical @regression |
| `REQ-DATA-14` | `TC-424` | API | @regression |
| `REQ-HOME-01` | `TC-010` | UI | @critical @smoke |
| `REQ-NAV-01` | `TC-012` | UI | @smoke |
| `REQ-NAV-02` | `TC-062` | UI | @regression |
| `REQ-OPS-01` | `TC-001` | API | @contract @smoke |
| `REQ-ORDER-01` | `TC-120` | UI | @critical @smoke |
| `REQ-ORDER-02` | `TC-121` | UI | @critical @smoke |
| `REQ-ORDER-03` | `TC-122` | UI | @regression |
| `REQ-ORDER-04` | `TC-123`, `TC-124` | UI | @critical @regression |
| `REQ-ORDER-05` | `TC-125` | UI | @critical @regression |
| `REQ-ORDER-06` | `TC-126` | UI | @critical @regression |
| `REQ-ORDER-07` | `TC-127` | UI | @critical @regression |
| `REQ-ORDER-08` | `TC-129` | UI | @regression |
| `REQ-ORDER-09` | `TC-130` | UI | @critical @smoke |
| `REQ-PAGE-01` | `TC-044`, `TC-048` | UI | @regression @smoke |
| `REQ-PAGE-02` | `TC-045`, `TC-351` | UI | @critical @known-bug @regression |
| `REQ-PAGE-03` | `TC-046` | UI | @regression |
| `REQ-PAGE-04` | `TC-047` | UI | @critical @regression |
| `REQ-PDP-01` | `TC-060` | UI | @critical @smoke |
| `REQ-PDP-02` | `TC-061`, `TC-065` | UI | @regression |
| `REQ-PDP-03` | `TC-063` | UI | @regression |
| `REQ-PDP-04` | `TC-064` | UI | @critical @smoke |
| `REQ-PDP-05` | `TC-066` | UI | @regression |
| `REQ-PDP-06` | `TC-070` | UI | @regression |
| `REQ-PDP-07` | `TC-071` | UI | @regression |
| `REQ-PDP-08` | `TC-457`, `TC-458` | UI | @regression @smoke |
| `REQ-PDP-09` | `TC-459`, `TC-460`, `TC-461` | UI | @regression |
| `REQ-PDP-10` | `TC-480`, `TC-481`, `TC-482` | UI | @regression @smoke |
| `REQ-PDP-11` | `TC-483`, `TC-484` | UI | @regression |
| `REQ-PDP-12` | `TC-485`, `TC-486` | UI | @critical @regression |
| `REQ-REV-01` | `TC-448` | UI | @regression @smoke |
| `REQ-REV-02` | `TC-449` | UI | @regression |
| `REQ-REV-03` | `TC-450` | UI | @regression |
| `REQ-REV-04` | `TC-451`, `TC-452` | UI | @regression |
| `REQ-REV-05` | `TC-453` | UI | @regression |
| `REQ-REV-06` | `TC-454`, `TC-455`, `TC-456` | UI | @critical @regression |
| `REQ-SEARCH-01` | `TC-050` | UI | @critical @smoke |
| `REQ-SEARCH-02` | `TC-051`, `TC-052` | UI | @regression |
| `REQ-SEARCH-03` | `TC-053` | UI | @regression |
| `REQ-SEARCH-04` | `TC-054` | UI | @regression |
| `REQ-SEARCH-05` | `TC-055`, `TC-056` | UI | @regression @smoke |
| `REQ-SEARCH-06` | `TC-057` | UI | @regression |
| `REQ-SEC-01` | `TC-085`, `TC-202` | UI, API | @regression @security |
| `REQ-SEC-02` | `TC-203`, `TC-260` | API | @security @smoke |
| `REQ-SEC-03` | `TC-128` | UI | @regression @security |
| `REQ-SEC-04` | `TC-241` | API | @critical @regression @security |
| `REQ-SEC-05` | `TC-257` | API | @critical @regression @security |
| `REQ-SEC-06` | `TC-258`, `TC-259` | API | @contract @critical @security |
| `REQ-SEC-07` | `TC-280` | API | @regression @security |
| `REQ-SEC-08` | `TC-292` | API | @critical @regression @security |
| `REQ-SEC-09` | `TC-293` | API | @critical @security |
| `REQ-SEC-10` | `TC-297` | API | @regression @security |
| `REQ-SEC-11` | `TC-298` | API | @critical @security |
| `REQ-SEC-12` | `TC-299` | API | @critical @security |
| `REQ-SEC-13` | `TC-300` | API | @regression @security |
| `REQ-SEC-14` | `TC-301` | API | @contract @critical @security |
| `REQ-SEC-15` | `TC-204` | API | @regression |
| `REQ-SEC-16` | `TC-425` | UI | @security @smoke |
| `REQ-SEC-17` | `TC-447` | API | @regression @security |
| `REQ-SORT-01` | `TC-040`, `TC-041`, `TC-043` | UI | @critical @regression @smoke |
| `REQ-SORT-02` | `TC-042` | UI | @regression |
| `REQ-THEME-01` | `TC-426`, `TC-429` | UI | @smoke |
| `REQ-THEME-02` | `TC-427` | UI | @critical @smoke |
| `REQ-THEME-03` | `TC-430` | UI | @critical @regression |
| `REQ-THEME-04` | `TC-428`, `TC-431` | UI | @regression |
| `REQ-THEME-05` | `TC-432` | UI | @regression |
| `REQ-VIS-01` | `TC-330`, `TC-331`, `TC-339` | Visual | @regression |
| `REQ-VIS-02` | `TC-332`, `TC-333` | Visual | @critical @regression |
| `REQ-VIS-03` | `TC-334` | Visual | @regression |
| `REQ-VIS-04` | `TC-335` | Visual | @critical @regression |
| `REQ-VIS-05` | `TC-336` | Visual | @critical @regression |
| `REQ-VIS-06` | `TC-337`, `TC-338` | Visual | @regression |
| `REQ-WISH-01` | `TC-493`, `TC-494`, `TC-495` | UI | @regression @smoke |
| `REQ-WISH-02` | `TC-492`, `TC-496` | UI | @regression @security |

## Test case → requirement

| Test case | Name | Requirements | Spec |
| --- | --- | --- | --- |
| `TC-001` | Sonde de disponibilité | `REQ-OPS-01` | `api/health.spec.ts` |
| `TC-010` | Structure de la page d’accueil | `REQ-HOME-01` | `ui/home.spec.ts` |
| `TC-011` | Compteur panier à l’état initial | `REQ-CART-01` | `ui/home.spec.ts` |
| `TC-012` | Navigation vers une catégorie | `REQ-NAV-01` | `ui/home.spec.ts` |
| `TC-020` | Catalogue sans filtre | `REQ-CAT-01` | `ui/catalogue.spec.ts` |
| `TC-021` | Filtre marque | `REQ-CAT-02` | `ui/catalogue.spec.ts` |
| `TC-022` | Filtre multi-marques | `REQ-CAT-02` | `ui/catalogue.spec.ts` |
| `TC-023` | Retrait d’un filtre marque | `REQ-CAT-02` | `ui/catalogue.spec.ts` |
| `TC-024` | Filtre par prix | `REQ-CAT-03` | `ui/catalogue.spec.ts` |
| `TC-025` | Filtre disponibilité | `REQ-CAT-04` | `ui/catalogue.spec.ts` |
| `TC-026` | Filtre promotions | `REQ-CAT-04` | `ui/catalogue.spec.ts` |
| `TC-027` | Filtre gaucher | `REQ-CAT-04` | `ui/catalogue.spec.ts` |
| `TC-028` | Filtre par note | `REQ-CAT-05` | `ui/catalogue.spec.ts` |
| `TC-029` | Cumul de filtres | `REQ-CAT-06` | `ui/catalogue.spec.ts` |
| `TC-030` | Réinitialisation des filtres | `REQ-CAT-07` | `ui/catalogue.spec.ts` |
| `TC-031` | Résultat vide | `REQ-CAT-08` | `ui/catalogue.spec.ts` |
| `TC-032` | Persistance des filtres | `REQ-CAT-09` | `ui/catalogue.spec.ts` |
| `TC-033` | URL de filtre partageable | `REQ-CAT-09` | `ui/catalogue.spec.ts` |
| `TC-040` | Tri prix croissant | `REQ-SORT-01` | `ui/tri-pagination.spec.ts` |
| `TC-041` | Tri prix décroissant | `REQ-SORT-01` | `ui/tri-pagination.spec.ts` |
| `TC-042` | Tri par note | `REQ-SORT-02` | `ui/tri-pagination.spec.ts` |
| `TC-043` | Retour au tri par défaut | `REQ-SORT-01` | `ui/tri-pagination.spec.ts` |
| `TC-044` | Pagination — découpage | `REQ-PAGE-01` | `ui/tri-pagination.spec.ts` |
| `TC-045` | Pagination — intégrité | `REQ-PAGE-02` | `ui/tri-pagination.spec.ts` |
| `TC-046` | Persistance du tri en pagination | `REQ-PAGE-03` | `ui/tri-pagination.spec.ts` |
| `TC-047` | Réinitialisation de page au filtrage | `REQ-PAGE-04` | `ui/tri-pagination.spec.ts` |
| `TC-048` | Pagination masquée | `REQ-PAGE-01` | `ui/tri-pagination.spec.ts` |
| `TC-050` | Recherche depuis le header | `REQ-SEARCH-01` | `ui/recherche.spec.ts` |
| `TC-051` | Recherche par marque | `REQ-SEARCH-02` | `ui/recherche.spec.ts` |
| `TC-052` | Recherche par SKU | `REQ-SEARCH-02` | `ui/recherche.spec.ts` |
| `TC-053` | Normalisation de la recherche | `REQ-SEARCH-03` | `ui/recherche.spec.ts` |
| `TC-054` | Recherche multi-termes | `REQ-SEARCH-04` | `ui/recherche.spec.ts` |
| `TC-055` | Recherche sans résultat | `REQ-SEARCH-05` | `ui/recherche.spec.ts` |
| `TC-056` | Recherche vide | `REQ-SEARCH-05` | `ui/recherche.spec.ts` |
| `TC-057` | Tri des résultats de recherche | `REQ-SEARCH-06` | `ui/recherche.spec.ts` |
| `TC-060` | Contenu de la fiche produit | `REQ-PDP-01` | `ui/fiche-produit.spec.ts` |
| `TC-061` | Caractéristiques produit | `REQ-PDP-02` | `ui/fiche-produit.spec.ts` |
| `TC-062` | Fil d’Ariane | `REQ-NAV-02` | `ui/fiche-produit.spec.ts` |
| `TC-063` | Affichage d’une promotion | `REQ-PDP-03` | `ui/fiche-produit.spec.ts` |
| `TC-064` | Produit indisponible | `REQ-PDP-04` | `ui/fiche-produit.spec.ts` |
| `TC-065` | Badge gaucher | `REQ-PDP-02` | `ui/fiche-produit.spec.ts` |
| `TC-066` | Cohérence note / avis | `REQ-PDP-05` | `ui/fiche-produit.spec.ts` |
| `TC-067` | Ajout au panier | `REQ-CART-02` | `ui/fiche-produit.spec.ts` |
| `TC-068` | Choix du coloris | `REQ-CART-03` | `ui/fiche-produit.spec.ts` |
| `TC-069` | Quantité maximale | `REQ-CART-05` | `ui/fiche-produit.spec.ts` |
| `TC-070` | Produits associés | `REQ-PDP-06` | `ui/fiche-produit.spec.ts` |
| `TC-071` | Produit introuvable | `REQ-PDP-07` | `ui/fiche-produit.spec.ts` |
| `TC-080` | Inscription depuis l’interface | `REQ-AUTH-01` | `ui/authentification.spec.ts` |
| `TC-081` | Validation du mot de passe | `REQ-AUTH-03` | `ui/authentification.spec.ts` |
| `TC-082` | Validation de l’e-mail | `REQ-AUTH-03` | `ui/authentification.spec.ts` |
| `TC-083` | Inscription en doublon | `REQ-AUTH-02` | `ui/authentification.spec.ts` |
| `TC-084` | Connexion nominale | `REQ-AUTH-04` | `ui/authentification.spec.ts` |
| `TC-085` | Connexion refusée | `REQ-SEC-01` | `ui/authentification.spec.ts` |
| `TC-086` | Redirection après connexion | `REQ-AUTH-05` | `ui/authentification.spec.ts` |
| `TC-087` | Déconnexion | `REQ-AUTH-06` | `ui/authentification.spec.ts` |
| `TC-088` | Historique de commandes vide | `REQ-ACC-01` | `ui/authentification.spec.ts` |
| `TC-100` | Affichage du panier | `REQ-CART-01` | `ui/panier.spec.ts` |
| `TC-101` | Frais de port sous le seuil | `REQ-CART-04` | `ui/panier.spec.ts` |
| `TC-102` | État vide du panier | `REQ-CART-01` | `ui/panier.spec.ts` |
| `TC-103` | Modification de quantité | `REQ-CART-06` | `ui/panier.spec.ts` |
| `TC-104` | Suppression d’une ligne | `REQ-CART-07` | `ui/panier.spec.ts` |
| `TC-105` | Panier vidé intégralement | `REQ-CART-07` | `ui/panier.spec.ts` |
| `TC-106` | Franchissement du seuil de port | `REQ-CART-04` | `ui/panier.spec.ts` |
| `TC-107` | Calcul de la TVA | `REQ-CART-08` | `ui/panier.spec.ts` |
| `TC-110` | Code promo valide | `REQ-COUPON-01` | `ui/panier.spec.ts` |
| `TC-111` | Retrait d’un code promo | `REQ-COUPON-02` | `ui/panier.spec.ts` |
| `TC-112` | Code promo inconnu | `REQ-COUPON-03` | `ui/panier.spec.ts` |
| `TC-113` | Code promo expiré | `REQ-COUPON-03` | `ui/panier.spec.ts` |
| `TC-114` | Code promo — minimum non atteint | `REQ-COUPON-04` | `ui/panier.spec.ts` |
| `TC-115` | Code promo par catégorie | `REQ-COUPON-05` | `ui/panier.spec.ts` |
| `TC-120` | Commande invité | `REQ-ORDER-01` | `ui/commande.spec.ts` |
| `TC-121` | Commande authentifiée | `REQ-ORDER-02` | `ui/commande.spec.ts` |
| `TC-122` | Navigation entre étapes | `REQ-ORDER-03` | `ui/commande.spec.ts` |
| `TC-123` | Validation de l’adresse | `REQ-ORDER-04` | `ui/commande.spec.ts` |
| `TC-124` | Format du code postal | `REQ-ORDER-04` | `ui/commande.spec.ts` |
| `TC-125` | CGV obligatoires | `REQ-ORDER-05` | `ui/commande.spec.ts` |
| `TC-126` | Remise reportée à la commande | `REQ-ORDER-06` | `ui/commande.spec.ts` |
| `TC-127` | Panier vidé après commande | `REQ-ORDER-07` | `ui/commande.spec.ts` |
| `TC-128` | Confirmation protégée | `REQ-SEC-03` | `ui/commande.spec.ts` |
| `TC-129` | Commande sans panier | `REQ-ORDER-08` | `ui/commande.spec.ts` |
| `TC-130` | Parcours d’achat de bout en bout | `REQ-ORDER-09` | `ui/parcours-achat.spec.ts` |
| `TC-140` | Comparaison de deux produits | `REQ-CMP-01` | `ui/comparateur.spec.ts` |
| `TC-141` | Limite du comparateur | `REQ-CMP-02` | `ui/comparateur.spec.ts` |
| `TC-142` | Caractéristiques hétérogènes | `REQ-CMP-03` | `ui/comparateur.spec.ts` |
| `TC-143` | Retrait du comparateur | `REQ-CMP-01` | `ui/comparateur.spec.ts` |
| `TC-144` | Comparateur vide | `REQ-CMP-04` | `ui/comparateur.spec.ts` |
| `TC-145` | Ajout au comparateur depuis la fiche | `REQ-CMP-05` | `ui/comparateur.spec.ts` |
| `TC-200` | Inscription nominale | `REQ-AUTH-01` | `api/auth.spec.ts` |
| `TC-201` | Inscription en doublon | `REQ-AUTH-02` | `api/auth.spec.ts` |
| `TC-202` | Non-divulgation des comptes | `REQ-SEC-01` | `api/auth.spec.ts` |
| `TC-203` | Accès profil sans jeton | `REQ-SEC-02` | `api/auth.spec.ts` |
| `TC-204` | Isolation des comptes de test | `REQ-SEC-15` | `api/auth.spec.ts` |
| `TC-210` | Liste de produits | `REQ-API-01` | `api/produits.spec.ts` |
| `TC-211` | Filtre catégorie API | `REQ-API-02` | `api/produits.spec.ts` |
| `TC-212` | Filtre prix API | `REQ-API-03` | `api/produits.spec.ts` |
| `TC-213` | Stabilité du tri | `REQ-API-04` | `api/produits.spec.ts` |
| `TC-214` | Intégrité de la pagination API | `REQ-API-05` | `api/produits.spec.ts` |
| `TC-215` | Cumul de filtres API | `REQ-API-06` | `api/produits.spec.ts` |
| `TC-216` | Recherche API | `REQ-API-07` | `api/produits.spec.ts` |
| `TC-217` | Détail produit | `REQ-API-08` | `api/produits.spec.ts` |
| `TC-218` | Produit introuvable API | `REQ-API-09` | `api/produits.spec.ts` |
| `TC-219` | Liste des catégories | `REQ-API-10` | `api/produits.spec.ts` |
| `TC-220` | Liste des marques | `REQ-API-11` | `api/produits.spec.ts` |
| `TC-230` | Ajout au panier API | `REQ-API-20` | `api/panier.spec.ts` |
| `TC-231` | Calcul des totaux | `REQ-API-21` | `api/panier.spec.ts` |
| `TC-232` | Cumul de quantité | `REQ-API-22` | `api/panier.spec.ts` |
| `TC-233` | Lignes par coloris | `REQ-API-22` | `api/panier.spec.ts` |
| `TC-234` | Mise à jour de quantité API | `REQ-API-23` | `api/panier.spec.ts` |
| `TC-235` | Quantité zéro | `REQ-API-23` | `api/panier.spec.ts` |
| `TC-236` | Ligne de panier introuvable | `REQ-API-24` | `api/panier.spec.ts` |
| `TC-237` | Ajout d’un produit épuisé | `REQ-API-25` | `api/panier.spec.ts` |
| `TC-238` | Plafond de quantité serveur | `REQ-API-26` | `api/panier.spec.ts` |
| `TC-239` | Coloris invalide | `REQ-API-27` | `api/panier.spec.ts` |
| `TC-240` | Vidage du panier | `REQ-API-28` | `api/panier.spec.ts` |
| `TC-241` | Isolation des paniers | `REQ-SEC-04` | `api/panier.spec.ts` |
| `TC-250` | Création de commande | `REQ-API-30` | `api/commandes.spec.ts` |
| `TC-251` | Décrément du stock | `REQ-API-31` | `api/commandes.spec.ts` |
| `TC-252` | Panier vidé — API | `REQ-API-32` | `api/commandes.spec.ts` |
| `TC-253` | Commande sans article | `REQ-API-33` | `api/commandes.spec.ts` |
| `TC-254` | Validation de l’adresse API | `REQ-API-34` | `api/commandes.spec.ts` |
| `TC-255` | CGV côté API | `REQ-API-35` | `api/commandes.spec.ts` |
| `TC-256` | Commande invité sans e-mail | `REQ-API-36` | `api/commandes.spec.ts` |
| `TC-257` | Jeton de commande invité | `REQ-SEC-05` | `api/commandes.spec.ts` |
| `TC-258` | Cloisonnement des commandes | `REQ-SEC-06` | `api/commandes.spec.ts` |
| `TC-259` | Historique cloisonné | `REQ-SEC-06` | `api/commandes.spec.ts` |
| `TC-260` | Historique sans jeton | `REQ-SEC-02` | `api/commandes.spec.ts` |
| `TC-270` | Application d’un code promo | `REQ-API-40` | `api/coupons-avis.spec.ts` |
| `TC-271` | Refus de code promo — inconnu | `REQ-API-41` | `api/coupons-avis.spec.ts` |
| `TC-272` | Code promo hors catégorie | `REQ-API-42` | `api/coupons-avis.spec.ts` |
| `TC-273` | Réévaluation du code promo | `REQ-API-43` | `api/coupons-avis.spec.ts` |
| `TC-274` | Simulation de code promo | `REQ-API-44` | `api/coupons-avis.spec.ts` |
| `TC-275` | Retrait de code promo API | `REQ-API-45` | `api/coupons-avis.spec.ts` |
| `TC-276` | Refus de code promo — expiré | `REQ-API-41` | `api/coupons-avis.spec.ts` |
| `TC-277` | Refus de code promo — sous le minimum d’achat | `REQ-API-41` | `api/coupons-avis.spec.ts` |
| `TC-280` | Avis sans authentification | `REQ-SEC-07` | `api/coupons-avis.spec.ts` |
| `TC-281` | Publication d’un avis | `REQ-API-50` | `api/coupons-avis.spec.ts` |
| `TC-282` | Avis en doublon | `REQ-API-51` | `api/coupons-avis.spec.ts` |
| `TC-283` | Note invalide | `REQ-API-52` | `api/coupons-avis.spec.ts` |
| `TC-284` | Pagination des avis | `REQ-API-53` | `api/coupons-avis.spec.ts` |
| `TC-285` | Étanchéité des pages d’avis | `REQ-API-53` | `api/coupons-avis.spec.ts` |
| `TC-286` | Tri des avis par note | `REQ-API-54` | `api/coupons-avis.spec.ts` |
| `TC-287` | Filtre des avis par note | `REQ-API-55` | `api/coupons-avis.spec.ts` |
| `TC-288` | Filtre d’avis invalide | `REQ-API-55` | `api/coupons-avis.spec.ts` |
| `TC-289` | Badge achat vérifié | `REQ-API-56` | `api/coupons-avis.spec.ts` |
| `TC-290` | JSON malformé | `REQ-API-60` | `api/negatifs-securite.spec.ts` |
| `TC-291` | Type de champ incorrect | `REQ-API-60` | `api/negatifs-securite.spec.ts` |
| `TC-292` | Quantité négative | `REQ-SEC-08` | `api/negatifs-securite.spec.ts` |
| `TC-293` | Falsification du prix | `REQ-SEC-09` | `api/negatifs-securite.spec.ts` |
| `TC-294` | Limite de pagination | `REQ-API-61` | `api/negatifs-securite.spec.ts` |
| `TC-295` | Page au-delà des résultats | `REQ-API-61` | `api/negatifs-securite.spec.ts` |
| `TC-296` | Tri inconnu | `REQ-API-61` | `api/negatifs-securite.spec.ts` |
| `TC-297` | Charges utiles hostiles | `REQ-SEC-10` | `api/negatifs-securite.spec.ts` |
| `TC-298` | Jeton falsifié | `REQ-SEC-11` | `api/negatifs-securite.spec.ts` |
| `TC-299` | Protection des hooks de test | `REQ-SEC-12` | `api/negatifs-securite.spec.ts` |
| `TC-300` | Route inconnue | `REQ-SEC-13` | `api/negatifs-securite.spec.ts` |
| `TC-301` | Non-divulgation du hachage | `REQ-SEC-14` | `api/negatifs-securite.spec.ts` |
| `TC-310` | Scan a11y — accueil | `REQ-A11Y-01` | `a11y/accessibilite.spec.ts` |
| `TC-311` | Scan a11y — catalogue | `REQ-A11Y-01` | `a11y/accessibilite.spec.ts` |
| `TC-312` | Scan a11y — fiche produit | `REQ-A11Y-01` | `a11y/accessibilite.spec.ts` |
| `TC-313` | Scan a11y — recherche | `REQ-A11Y-01` | `a11y/accessibilite.spec.ts` |
| `TC-314` | Scan a11y — connexion | `REQ-A11Y-01` | `a11y/accessibilite.spec.ts` |
| `TC-315` | Scan a11y — inscription | `REQ-A11Y-01` | `a11y/accessibilite.spec.ts` |
| `TC-316` | Scan a11y — comparateur | `REQ-A11Y-01` | `a11y/accessibilite.spec.ts` |
| `TC-317` | Scan a11y — panier | `REQ-A11Y-01` | `a11y/accessibilite.spec.ts` |
| `TC-318` | Scan a11y — tunnel de commande | `REQ-A11Y-02` | `a11y/accessibilite.spec.ts` |
| `TC-319` | Scan a11y — erreurs de formulaire | `REQ-A11Y-03` | `a11y/accessibilite.spec.ts` |
| `TC-320` | Lien d’évitement | `REQ-A11Y-04` | `a11y/accessibilite.spec.ts` |
| `TC-321` | Parcours clavier | `REQ-A11Y-05` | `a11y/accessibilite.spec.ts` |
| `TC-322` | Alternatives textuelles | `REQ-A11Y-06` | `a11y/accessibilite.spec.ts` |
| `TC-330` | Baseline — en-tête | `REQ-VIS-01` | `visual/composants.visual.spec.ts` |
| `TC-331` | Baseline — hero | `REQ-VIS-01` | `visual/composants.visual.spec.ts` |
| `TC-332` | Baseline — carte produit | `REQ-VIS-02` | `visual/composants.visual.spec.ts` |
| `TC-333` | Baseline — carte en rupture | `REQ-VIS-02` | `visual/composants.visual.spec.ts` |
| `TC-334` | Baseline — panneau de filtres | `REQ-VIS-03` | `visual/composants.visual.spec.ts` |
| `TC-335` | Baseline — bloc d’achat | `REQ-VIS-04` | `visual/composants.visual.spec.ts` |
| `TC-336` | Baseline — récapitulatif panier | `REQ-VIS-05` | `visual/composants.visual.spec.ts` |
| `TC-337` | Baseline — panier vide | `REQ-VIS-06` | `visual/composants.visual.spec.ts` |
| `TC-338` | Baseline — catalogue vide | `REQ-VIS-06` | `visual/composants.visual.spec.ts` |
| `TC-339` | Baseline — pied de page | `REQ-VIS-01` | `visual/composants.visual.spec.ts` |
| `TC-350` | Arrondi de la remise | `REQ-COUPON-01` | `ui/bugs-connus.spec.ts` |
| `TC-351` | Portée du tri en pagination | `REQ-PAGE-02` | `ui/bugs-connus.spec.ts` |
| `TC-352` | Libellés de formulaire | `REQ-A11Y-03` | `ui/bugs-connus.spec.ts` |
| `TC-400` | Course sur la dernière unité en stock | `REQ-DATA-01` | `api/concurrence.spec.ts` |
| `TC-401` | Le stock ne passe jamais sous zéro | `REQ-DATA-02` | `api/concurrence.spec.ts` |
| `TC-402` | Atomicité du paiement | `REQ-DATA-03` | `api/concurrence.spec.ts` |
| `TC-403` | Aucune commande partielle | `REQ-DATA-03` | `api/concurrence.spec.ts` |
| `TC-404` | Course sur l’unicité de l’adresse e-mail | `REQ-DATA-04` | `api/concurrence.spec.ts` |
| `TC-420` | Le panier n’est matérialisé qu’au premier ajout | `REQ-DATA-10` | `api/retention.spec.ts` |
| `TC-421` | Rétention des paniers vides | `REQ-DATA-11` | `api/retention.spec.ts` |
| `TC-422` | Rétention des paniers invités | `REQ-DATA-12` | `api/retention.spec.ts` |
| `TC-423` | Exemption des paniers d’un compte | `REQ-DATA-13` | `api/retention.spec.ts` |
| `TC-424` | Balayage des comptes dormants | `REQ-DATA-14` | `api/retention.spec.ts` |
| `TC-425` | Absence du tracker sous E2E_TEST_MODE | `REQ-SEC-16` | `ui/analytics.spec.ts` |
| `TC-426` | Thème clair suivi depuis la préférence de l’appareil | `REQ-THEME-01` | `ui/theme.spec.ts` |
| `TC-427` | Cycle Système → Clair → Sombre → Système | `REQ-THEME-02` | `ui/theme.spec.ts` |
| `TC-428` | Persistance du thème choisi d’une page à l’autre | `REQ-THEME-04` | `ui/theme.spec.ts` |
| `TC-429` | Thème sombre suivi depuis la préférence de l’appareil | `REQ-THEME-01` | `ui/theme.spec.ts` |
| `TC-430` | Le thème choisi prime sur celui de l’appareil | `REQ-THEME-03` | `ui/theme.spec.ts` |
| `TC-431` | Absence de scintillement — thème posé avant le framework | `REQ-THEME-04` | `ui/theme.spec.ts` |
| `TC-432` | Le retour à « Système » efface le choix mémorisé | `REQ-THEME-05` | `ui/theme.spec.ts` |
| `TC-440` | Scan a11y sombre — accueil | `REQ-A11Y-07` | `a11y/accessibilite.spec.ts` |
| `TC-441` | Scan a11y sombre — catalogue | `REQ-A11Y-07` | `a11y/accessibilite.spec.ts` |
| `TC-442` | Scan a11y sombre — fiche produit | `REQ-A11Y-07` | `a11y/accessibilite.spec.ts` |
| `TC-443` | Scan a11y sombre — recherche | `REQ-A11Y-07` | `a11y/accessibilite.spec.ts` |
| `TC-444` | Scan a11y sombre — connexion | `REQ-A11Y-07` | `a11y/accessibilite.spec.ts` |
| `TC-445` | Scan a11y sombre — inscription | `REQ-A11Y-07` | `a11y/accessibilite.spec.ts` |
| `TC-446` | Scan a11y sombre — comparateur | `REQ-A11Y-07` | `a11y/accessibilite.spec.ts` |
| `TC-447` | CSP sur origine en clair | `REQ-SEC-17` | `api/negatifs-securite.spec.ts` |
| `TC-448` | Histogramme des notes | `REQ-REV-01` | `ui/avis.spec.ts` |
| `TC-449` | Pagination des avis | `REQ-REV-02` | `ui/avis.spec.ts` |
| `TC-450` | Tri des avis | `REQ-REV-03` | `ui/avis.spec.ts` |
| `TC-451` | Filtre des avis par note | `REQ-REV-04` | `ui/avis.spec.ts` |
| `TC-452` | Filtre d’avis sans résultat | `REQ-REV-04` | `ui/avis.spec.ts` |
| `TC-453` | Mention achat vérifié | `REQ-REV-05` | `ui/avis.spec.ts` |
| `TC-454` | Dépôt d’avis sans compte | `REQ-REV-06` | `ui/avis.spec.ts` |
| `TC-455` | Publication d’un avis depuis la fiche | `REQ-REV-06` | `ui/avis.spec.ts` |
| `TC-456` | Avis en doublon depuis la fiche | `REQ-REV-06` | `ui/avis.spec.ts` |
| `TC-457` | Délai d’expédition, produit disponible | `REQ-PDP-08` | `ui/disponibilite.spec.ts` |
| `TC-458` | Délai de réapprovisionnement | `REQ-PDP-08` | `ui/disponibilite.spec.ts` |
| `TC-459` | Mention de stock faible | `REQ-PDP-09` | `ui/disponibilite.spec.ts` |
| `TC-460` | Frontière du stock faible | `REQ-PDP-09` | `ui/disponibilite.spec.ts` |
| `TC-461` | Cohérence catalogue / fiche | `REQ-PDP-09` | `ui/disponibilite.spec.ts` |
| `TC-462` | Persistance de la sélection | `REQ-CMP-05` | `ui/comparateur.spec.ts` |
| `TC-463` | Retrait depuis le bouton | `REQ-CMP-05` | `ui/comparateur.spec.ts` |
| `TC-464` | Limite atteinte | `REQ-CMP-02` | `ui/comparateur.spec.ts` |
| `TC-465` | Vidage de la sélection | `REQ-CMP-05` | `ui/comparateur.spec.ts` |
| `TC-466` | Lien de comparaison partagé | `REQ-CMP-06` | `ui/comparateur.spec.ts` |
| `TC-467` | Pas d’alerte sur produit disponible | `REQ-ALERT-02` | `ui/alerte-stock.spec.ts` |
| `TC-468` | Alerte sans compte | `REQ-ALERT-02` | `ui/alerte-stock.spec.ts` |
| `TC-469` | Inscription à une alerte | `REQ-ALERT-03` | `ui/alerte-stock.spec.ts` |
| `TC-470` | Annulation depuis la fiche | `REQ-ALERT-03` | `ui/alerte-stock.spec.ts` |
| `TC-471` | Aucune alerte | `REQ-ALERT-03` | `ui/alerte-stock.spec.ts` |
| `TC-472` | Alertes protégées | `REQ-ALERT-02` | `ui/alerte-stock.spec.ts` |
| `TC-473` | Alerte sans authentification | `REQ-API-57` | `api/alertes.spec.ts` |
| `TC-474` | Alerte sur produit disponible | `REQ-API-57` | `api/alertes.spec.ts` |
| `TC-475` | Inscription idempotente | `REQ-API-58` | `api/alertes.spec.ts` |
| `TC-476` | Cloisonnement des alertes | `REQ-API-59` | `api/alertes.spec.ts` |
| `TC-477` | Annulation d’une alerte | `REQ-API-58` | `api/alertes.spec.ts` |
| `TC-478` | Déclenchement au retour en stock | `REQ-ALERT-01` | `api/alertes.spec.ts` |
| `TC-479` | Balayage sans retour en stock | `REQ-ALERT-01` | `api/alertes.spec.ts` |
| `TC-480` | Onglet par défaut | `REQ-PDP-10` | `ui/fiche-details.spec.ts` |
| `TC-481` | Onglet dans l’URL | `REQ-PDP-10` | `ui/fiche-details.spec.ts` |
| `TC-482` | Onglet inconnu | `REQ-PDP-10` | `ui/fiche-details.spec.ts` |
| `TC-483` | Accessoires compatibles | `REQ-PDP-11` | `ui/fiche-details.spec.ts` |
| `TC-484` | Ordre total des accessoires | `REQ-PDP-11` | `ui/fiche-details.spec.ts` |
| `TC-485` | Co-achat sans donnée | `REQ-PDP-12` | `ui/fiche-details.spec.ts` |
| `TC-486` | Co-achat observé | `REQ-PDP-12` | `ui/fiche-details.spec.ts` |
| `TC-487` | Favori sans authentification | `REQ-API-62` | `api/favoris.spec.ts` |
| `TC-488` | Enregistrement idempotent | `REQ-API-63` | `api/favoris.spec.ts` |
| `TC-489` | Retrait d’un favori | `REQ-API-63` | `api/favoris.spec.ts` |
| `TC-490` | Cloisonnement des favoris | `REQ-API-64` | `api/favoris.spec.ts` |
| `TC-491` | Favori et état courant | `REQ-API-63` | `api/favoris.spec.ts` |
| `TC-492` | Favori sans compte | `REQ-WISH-02` | `ui/favoris.spec.ts` |
| `TC-493` | Enregistrement d’un favori | `REQ-WISH-01` | `ui/favoris.spec.ts` |
| `TC-494` | Retrait d’un favori | `REQ-WISH-01` | `ui/favoris.spec.ts` |
| `TC-495` | Aucun favori | `REQ-WISH-01` | `ui/favoris.spec.ts` |
| `TC-496` | Favoris protégés | `REQ-WISH-02` | `ui/favoris.spec.ts` |

## Verified outside the automated suite

- `REQ-DATA-05` — `scripts/verifier-persistance.sh`
