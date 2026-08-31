import { z } from 'zod';

import {
  addressSchema,
  apiErrorSchema,
  authResponseSchema,
  brandListSchema,
  cartSchema,
  categoryListSchema,
  couponPreviewSchema,
  healthSchema,
  orderListSchema,
  orderSchema,
  orderWithTokenSchema,
  paginatedProductsSchema,
  productDetailSchema,
  publicUserSchema,
  reviewPageSchema,
  reviewSchema,
  stockAlertListSchema,
  stockAlertSchema,
} from '@/api/schemas';

/**
 * Description des opérations de l'API publique.
 *
 * Le sens de dérivation mérite d'être explicité, parce qu'il est l'inverse de
 * celui qu'on attend : la spécification OpenAPI est **produite** depuis les
 * schémas de contrat, pas l'inverse.
 *
 * Écrire la spec à la main et en dériver les schémas donnerait deux descriptions
 * de la même API, dont une seule est exécutée. La seconde dérive — c'est
 * exactement ce que ce dépôt refuse pour la matrice de traçabilité, générée
 * depuis les annotations et vérifiée en CI. Une spec qu'aucun test ne traverse
 * ne décrit pas une API, elle décrit une intention.
 *
 * Ici, les schémas sont ce que 74 tests d'API valident à chaque run. En faire
 * la source de la spec garantit que le document publié décrit l'API réellement
 * servie, et le contrôle `openapi:check` rend l'écart impossible à ignorer.
 *
 * Ce qui reste écrit à la main, c'est ce qu'un schéma de réponse ne porte pas :
 * les chemins, les verbes, les codes de statut, les paramètres.
 */

const parametreQuery = (nom: string, description: string, schema: z.ZodType) => ({
  nom,
  dans: 'query' as const,
  description,
  schema,
});

const parametreChemin = (nom: string, description: string, schema: z.ZodType) => ({
  nom,
  dans: 'path' as const,
  description,
  schema,
});

export interface Operation {
  chemin: string;
  methode: 'get' | 'post' | 'patch' | 'delete';
  resume: string;
  etiquette: string;
  authentification?: 'cookie-ou-bearer' | 'panier';
  parametres?: { nom: string; dans: 'query' | 'path'; description: string; schema: z.ZodType }[];
  corps?: z.ZodType;
  reponses: { code: number; description: string; schema?: z.ZodType }[];
}

const erreur = (code: number, description: string) => ({ code, description, schema: apiErrorSchema });

export const OPERATIONS: Operation[] = [
  {
    chemin: '/api/health',
    methode: 'get',
    resume: 'État du service',
    etiquette: 'Supervision',
    reponses: [{ code: 200, description: 'Le service répond.', schema: healthSchema }],
  },
  {
    chemin: '/api/products',
    methode: 'get',
    resume: 'Lister le catalogue',
    etiquette: 'Catalogue',
    parametres: [
      parametreQuery('category', 'Slug de catégorie.', z.string()),
      parametreQuery('brand', 'Marque, répétable.', z.string()),
      parametreQuery('q', 'Recherche plein texte, sur sous-chaîne.', z.string()),
      parametreQuery('minPrice', 'Prix minimum, en centimes.', z.number().int()),
      parametreQuery('maxPrice', 'Prix maximum, en centimes.', z.number().int()),
      parametreQuery('inStock', 'Ne garder que les produits disponibles.', z.boolean()),
      parametreQuery('leftHanded', 'Ne garder que les modèles gauchers.', z.boolean()),
      parametreQuery('onSale', 'Ne garder que les produits remisés.', z.boolean()),
      parametreQuery('sort', 'Tri appliqué avant pagination.', z.string()),
      parametreQuery('page', 'Page demandée, à partir de 1.', z.number().int().positive()),
      parametreQuery('perPage', 'Taille de page.', z.number().int().positive()),
    ],
    reponses: [
      { code: 200, description: 'Page de résultats.', schema: paginatedProductsSchema },
      erreur(422, 'Paramètre hors du schéma attendu.'),
    ],
  },
  {
    chemin: '/api/products/{slug}',
    methode: 'get',
    resume: 'Détail d’un produit',
    etiquette: 'Catalogue',
    parametres: [parametreChemin('slug', 'Identifiant lisible du produit.', z.string())],
    reponses: [
      { code: 200, description: 'Le produit et ses avis.', schema: productDetailSchema },
      erreur(404, 'Aucun produit pour ce slug.'),
    ],
  },
  {
    chemin: '/api/products/{slug}/reviews',
    methode: 'get',
    resume: 'Lister les avis d’un produit',
    etiquette: 'Catalogue',
    parametres: [
      parametreChemin('slug', 'Identifiant lisible du produit.', z.string()),
      parametreQuery('sort', 'recents | anciens | note-desc | note-asc.', z.string()),
      parametreQuery('note', 'Ne garder que les avis à ce nombre d’étoiles.', z.number().int()),
      parametreQuery('page', 'Page demandée, à partir de 1.', z.number().int().positive()),
      parametreQuery('limit', 'Taille de page, 50 au maximum.', z.number().int().positive()),
    ],
    reponses: [
      { code: 200, description: 'Page d’avis et répartition des notes.', schema: reviewPageSchema },
      erreur(404, 'Aucun produit pour ce slug.'),
      erreur(422, 'Paramètre hors du schéma attendu.'),
    ],
  },
  {
    chemin: '/api/products/{slug}/reviews',
    methode: 'post',
    resume: 'Déposer un avis',
    etiquette: 'Catalogue',
    authentification: 'cookie-ou-bearer',
    parametres: [parametreChemin('slug', 'Identifiant lisible du produit.', z.string())],
    corps: z
      .object({
        rating: z.number().int().min(1).max(5),
        title: z.string().min(1),
        comment: z.string().min(1),
      })
      .strict(),
    reponses: [
      { code: 201, description: 'Avis enregistré.', schema: reviewSchema },
      erreur(401, 'Porteur absent ou invalide.'),
      erreur(404, 'Aucun produit pour ce slug.'),
      erreur(409, 'Ce client a déjà publié un avis sur ce produit.'),
      erreur(422, 'Corps hors du schéma attendu.'),
    ],
  },
  {
    chemin: '/api/products/{slug}/alerts',
    methode: 'post',
    resume: 'Être prévenu du retour en stock',
    etiquette: 'Catalogue',
    authentification: 'cookie-ou-bearer',
    parametres: [parametreChemin('slug', 'Identifiant lisible du produit.', z.string())],
    reponses: [
      { code: 201, description: 'Alerte enregistrée.', schema: stockAlertSchema },
      erreur(401, 'Porteur absent ou invalide.'),
      erreur(404, 'Aucun produit pour ce slug.'),
      erreur(409, 'Le produit est déjà disponible.'),
    ],
  },
  {
    chemin: '/api/products/{slug}/alerts',
    methode: 'delete',
    resume: 'Annuler une alerte de retour en stock',
    etiquette: 'Catalogue',
    authentification: 'cookie-ou-bearer',
    parametres: [parametreChemin('slug', 'Identifiant lisible du produit.', z.string())],
    reponses: [
      { code: 200, description: 'Alerte retirée.', schema: z.object({ removed: z.literal(true) }).strict() },
      erreur(401, 'Porteur absent ou invalide.'),
      erreur(404, 'Aucune alerte sur ce produit, ou produit inconnu.'),
    ],
  },
  {
    chemin: '/api/alerts',
    methode: 'get',
    resume: 'Lister ses alertes de retour en stock',
    etiquette: 'Compte',
    authentification: 'cookie-ou-bearer',
    reponses: [
      { code: 200, description: 'Les alertes du client connecté.', schema: stockAlertListSchema },
      erreur(401, 'Porteur absent ou invalide.'),
    ],
  },
  {
    chemin: '/api/categories',
    methode: 'get',
    resume: 'Lister les catégories',
    etiquette: 'Catalogue',
    reponses: [{ code: 200, description: 'Catégories et effectifs.', schema: categoryListSchema }],
  },
  {
    chemin: '/api/brands',
    methode: 'get',
    resume: 'Lister les marques',
    etiquette: 'Catalogue',
    reponses: [{ code: 200, description: 'Marques et effectifs.', schema: brandListSchema }],
  },
  {
    chemin: '/api/auth/register',
    methode: 'post',
    resume: 'Créer un compte',
    etiquette: 'Authentification',
    corps: z
      .object({
        email: z.string().email(),
        password: z.string().min(8),
        firstName: z.string().min(1),
        lastName: z.string().min(1),
      })
      .strict(),
    reponses: [
      { code: 201, description: 'Compte créé, porteur émis.', schema: authResponseSchema },
      erreur(409, 'Adresse déjà enregistrée.'),
      erreur(422, 'Corps hors du schéma attendu.'),
    ],
  },
  {
    chemin: '/api/auth/login',
    methode: 'post',
    resume: 'Ouvrir une session',
    etiquette: 'Authentification',
    corps: z.object({ email: z.string().email(), password: z.string().min(1) }).strict(),
    reponses: [
      { code: 200, description: 'Porteur émis.', schema: authResponseSchema },
      erreur(401, 'Identifiants refusés.'),
      erreur(422, 'Corps hors du schéma attendu.'),
    ],
  },
  {
    chemin: '/api/auth/logout',
    methode: 'post',
    resume: 'Fermer la session',
    etiquette: 'Authentification',
    reponses: [{ code: 204, description: 'Cookie de session effacé.' }],
  },
  {
    chemin: '/api/auth/me',
    methode: 'get',
    resume: 'Profil du porteur',
    etiquette: 'Authentification',
    authentification: 'cookie-ou-bearer',
    reponses: [
      { code: 200, description: 'Le compte authentifié.', schema: publicUserSchema },
      erreur(401, 'Porteur absent ou invalide.'),
    ],
  },
  {
    chemin: '/api/cart',
    methode: 'get',
    resume: 'Lire le panier',
    etiquette: 'Panier',
    authentification: 'panier',
    reponses: [{ code: 200, description: 'Le panier et ses totaux.', schema: cartSchema }],
  },
  {
    chemin: '/api/cart/items',
    methode: 'post',
    resume: 'Ajouter une ligne',
    etiquette: 'Panier',
    authentification: 'panier',
    corps: z
      .object({ productId: z.string().min(1), quantity: z.number().int().min(1).max(10) })
      .strict(),
    reponses: [
      { code: 201, description: 'Panier après ajout.', schema: cartSchema },
      erreur(404, 'Produit inconnu.'),
      erreur(409, 'Stock insuffisant.'),
      erreur(422, 'Corps hors du schéma attendu.'),
    ],
  },
  {
    chemin: '/api/cart/items/{itemId}',
    methode: 'patch',
    resume: 'Modifier une quantité',
    etiquette: 'Panier',
    authentification: 'panier',
    parametres: [parametreChemin('itemId', 'Identifiant de la ligne.', z.string())],
    corps: z.object({ quantity: z.number().int().min(0).max(10) }).strict(),
    reponses: [
      { code: 200, description: 'Panier après modification.', schema: cartSchema },
      erreur(404, 'Ligne absente du panier.'),
      erreur(409, 'Stock insuffisant.'),
      erreur(422, 'Corps hors du schéma attendu.'),
    ],
  },
  {
    chemin: '/api/cart/items/{itemId}',
    methode: 'delete',
    resume: 'Retirer une ligne',
    etiquette: 'Panier',
    authentification: 'panier',
    parametres: [parametreChemin('itemId', 'Identifiant de la ligne.', z.string())],
    reponses: [
      { code: 200, description: 'Panier après retrait.', schema: cartSchema },
      erreur(404, 'Ligne absente du panier.'),
    ],
  },
  {
    chemin: '/api/cart/coupon',
    methode: 'post',
    resume: 'Appliquer un coupon',
    etiquette: 'Panier',
    authentification: 'panier',
    corps: z.object({ code: z.string().min(1) }).strict(),
    reponses: [
      { code: 200, description: 'Panier avec la remise appliquée.', schema: cartSchema },
      erreur(404, 'Coupon inconnu.'),
      erreur(409, 'Coupon inapplicable — expiré, minimum non atteint, catégorie absente.'),
    ],
  },
  {
    chemin: '/api/cart/coupon',
    methode: 'delete',
    resume: 'Retirer le coupon',
    etiquette: 'Panier',
    authentification: 'panier',
    reponses: [{ code: 200, description: 'Panier sans remise.', schema: cartSchema }],
  },
  {
    chemin: '/api/coupons/validate',
    methode: 'post',
    resume: 'Éprouver un coupon sans l’appliquer',
    etiquette: 'Panier',
    corps: z.object({ code: z.string().min(1) }).strict(),
    reponses: [
      { code: 200, description: 'Verdict et remise simulée.', schema: couponPreviewSchema },
      erreur(422, 'Corps hors du schéma attendu.'),
    ],
  },
  {
    chemin: '/api/orders',
    methode: 'post',
    resume: 'Passer commande',
    etiquette: 'Commandes',
    authentification: 'panier',
    corps: z
      .object({
        shippingAddress: addressSchema,
        billingAddress: addressSchema.optional(),
        paymentMethod: z.enum(['carte', 'virement', 'paypal']),
      })
      .strict(),
    reponses: [
      { code: 201, description: 'Commande créée, jeton d’accès émis.', schema: orderWithTokenSchema },
      erreur(409, 'Panier vide ou stock insuffisant.'),
      erreur(422, 'Corps hors du schéma attendu.'),
    ],
  },
  {
    chemin: '/api/orders',
    methode: 'get',
    resume: 'Lister ses commandes',
    etiquette: 'Commandes',
    authentification: 'cookie-ou-bearer',
    reponses: [
      { code: 200, description: 'Commandes du compte.', schema: orderListSchema },
      erreur(401, 'Porteur absent ou invalide.'),
    ],
  },
  {
    chemin: '/api/orders/{id}',
    methode: 'get',
    resume: 'Détail d’une commande',
    etiquette: 'Commandes',
    parametres: [parametreChemin('id', 'Référence de la commande.', z.string())],
    reponses: [
      { code: 200, description: 'La commande.', schema: orderSchema },
      erreur(403, 'Jeton d’accès absent ou étranger à la commande.'),
      erreur(404, 'Référence inconnue.'),
    ],
  },
];
