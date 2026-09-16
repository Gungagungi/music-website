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
} from '@/api/schemas';

/**
 * Description of the public API's operations.
 *
 * The direction of derivation deserves to be spelled out, because it is the
 * opposite of what one expects: the OpenAPI specification is **produced** from
 * the contract schemas, not the other way round.
 *
 * Writing the spec by hand and deriving the schemas from it would give two
 * descriptions of the same API, only one of which is executed. The other one
 * drifts — exactly what this repository refuses for the traceability matrix,
 * generated from the annotations and checked in CI. A spec no test goes through
 * does not describe an API, it describes an intention.
 *
 * Here, the schemas are what 74 API tests validate on every run. Making them
 * the source of the spec guarantees that the published document describes the
 * API actually served, and the `openapi:check` control makes any gap impossible
 * to ignore.
 *
 * What remains written by hand is what a response schema does not carry: paths,
 * verbs, status codes, parameters.
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
    resume: 'Service status',
    etiquette: 'Monitoring',
    reponses: [{ code: 200, description: 'The service is responding.', schema: healthSchema }],
  },
  {
    chemin: '/api/products',
    methode: 'get',
    resume: 'List the catalogue',
    etiquette: 'Catalogue',
    parametres: [
      parametreQuery('category', 'Category slug.', z.string()),
      parametreQuery('brand', 'Brand, repeatable.', z.string()),
      parametreQuery('q', 'Full-text search, by substring.', z.string()),
      parametreQuery('minPrice', 'Minimum price, in cents.', z.number().int()),
      parametreQuery('maxPrice', 'Maximum price, in cents.', z.number().int()),
      parametreQuery('inStock', 'Keep only products in stock.', z.boolean()),
      parametreQuery('leftHanded', 'Keep only left-handed models.', z.boolean()),
      parametreQuery('onSale', 'Keep only discounted products.', z.boolean()),
      parametreQuery('sort', 'Sort applied before pagination.', z.string()),
      parametreQuery('page', 'Requested page, starting at 1.', z.number().int().positive()),
      parametreQuery('perPage', 'Page size.', z.number().int().positive()),
    ],
    reponses: [
      { code: 200, description: 'Page of results.', schema: paginatedProductsSchema },
      erreur(422, 'Parameter outside the expected schema.'),
    ],
  },
  {
    chemin: '/api/products/{slug}',
    methode: 'get',
    resume: 'Product details',
    etiquette: 'Catalogue',
    parametres: [parametreChemin('slug', 'Human-readable product identifier.', z.string())],
    reponses: [
      { code: 200, description: 'The product and its reviews.', schema: productDetailSchema },
      erreur(404, 'No product for this slug.'),
    ],
  },
  {
    chemin: '/api/products/{slug}/reviews',
    methode: 'get',
    resume: 'List a product’s reviews',
    etiquette: 'Catalogue',
    parametres: [
      parametreChemin('slug', 'Human-readable product identifier.', z.string()),
      parametreQuery('sort', 'recents | anciens | note-desc | note-asc.', z.string()),
      parametreQuery('note', 'Keep only reviews with this number of stars.', z.number().int()),
      parametreQuery('page', 'Requested page, starting at 1.', z.number().int().positive()),
      parametreQuery('limit', 'Page size, 50 at most.', z.number().int().positive()),
    ],
    reponses: [
      { code: 200, description: 'Page of reviews and rating distribution.', schema: reviewPageSchema },
      erreur(404, 'No product for this slug.'),
      erreur(422, 'Parameter outside the expected schema.'),
    ],
  },
  {
    chemin: '/api/products/{slug}/reviews',
    methode: 'post',
    resume: 'Post a review',
    etiquette: 'Catalogue',
    authentification: 'cookie-ou-bearer',
    parametres: [parametreChemin('slug', 'Human-readable product identifier.', z.string())],
    corps: z
      .object({
        rating: z.number().int().min(1).max(5),
        title: z.string().min(1),
        comment: z.string().min(1),
      })
      .strict(),
    reponses: [
      { code: 201, description: 'Review saved.', schema: reviewSchema },
      erreur(401, 'Missing or invalid bearer.'),
      erreur(404, 'No product for this slug.'),
      erreur(409, 'This customer has already posted a review for this product.'),
      erreur(422, 'Body outside the expected schema.'),
    ],
  },
  {
    chemin: '/api/categories',
    methode: 'get',
    resume: 'List categories',
    etiquette: 'Catalogue',
    reponses: [{ code: 200, description: 'Categories and counts.', schema: categoryListSchema }],
  },
  {
    chemin: '/api/brands',
    methode: 'get',
    resume: 'List brands',
    etiquette: 'Catalogue',
    reponses: [{ code: 200, description: 'Brands and counts.', schema: brandListSchema }],
  },
  {
    chemin: '/api/auth/register',
    methode: 'post',
    resume: 'Create an account',
    etiquette: 'Authentication',
    corps: z
      .object({
        email: z.string().email(),
        password: z.string().min(8),
        firstName: z.string().min(1),
        lastName: z.string().min(1),
      })
      .strict(),
    reponses: [
      { code: 201, description: 'Account created, bearer issued.', schema: authResponseSchema },
      erreur(409, 'Email address already registered.'),
      erreur(422, 'Body outside the expected schema.'),
    ],
  },
  {
    chemin: '/api/auth/login',
    methode: 'post',
    resume: 'Log in',
    etiquette: 'Authentication',
    corps: z.object({ email: z.string().email(), password: z.string().min(1) }).strict(),
    reponses: [
      { code: 200, description: 'Bearer issued.', schema: authResponseSchema },
      erreur(401, 'Credentials rejected.'),
      erreur(422, 'Body outside the expected schema.'),
    ],
  },
  {
    chemin: '/api/auth/logout',
    methode: 'post',
    resume: 'Log out',
    etiquette: 'Authentication',
    reponses: [{ code: 204, description: 'Session cookie cleared.' }],
  },
  {
    chemin: '/api/auth/me',
    methode: 'get',
    resume: 'Bearer’s profile',
    etiquette: 'Authentication',
    authentification: 'cookie-ou-bearer',
    reponses: [
      { code: 200, description: 'The authenticated account.', schema: publicUserSchema },
      erreur(401, 'Missing or invalid bearer.'),
    ],
  },
  {
    chemin: '/api/cart',
    methode: 'get',
    resume: 'Read the cart',
    etiquette: 'Cart',
    authentification: 'panier',
    reponses: [{ code: 200, description: 'The cart and its totals.', schema: cartSchema }],
  },
  {
    chemin: '/api/cart/items',
    methode: 'post',
    resume: 'Add a line',
    etiquette: 'Cart',
    authentification: 'panier',
    corps: z
      .object({ productId: z.string().min(1), quantity: z.number().int().min(1).max(10) })
      .strict(),
    reponses: [
      { code: 201, description: 'Cart after adding.', schema: cartSchema },
      erreur(404, 'Unknown product.'),
      erreur(409, 'Insufficient stock.'),
      erreur(422, 'Body outside the expected schema.'),
    ],
  },
  {
    chemin: '/api/cart/items/{itemId}',
    methode: 'patch',
    resume: 'Change a quantity',
    etiquette: 'Cart',
    authentification: 'panier',
    parametres: [parametreChemin('itemId', 'Line identifier.', z.string())],
    corps: z.object({ quantity: z.number().int().min(0).max(10) }).strict(),
    reponses: [
      { code: 200, description: 'Cart after the change.', schema: cartSchema },
      erreur(404, 'Line not in the cart.'),
      erreur(409, 'Insufficient stock.'),
      erreur(422, 'Body outside the expected schema.'),
    ],
  },
  {
    chemin: '/api/cart/items/{itemId}',
    methode: 'delete',
    resume: 'Remove a line',
    etiquette: 'Cart',
    authentification: 'panier',
    parametres: [parametreChemin('itemId', 'Line identifier.', z.string())],
    reponses: [
      { code: 200, description: 'Cart after removal.', schema: cartSchema },
      erreur(404, 'Line not in the cart.'),
    ],
  },
  {
    chemin: '/api/cart/coupon',
    methode: 'post',
    resume: 'Apply a coupon',
    etiquette: 'Cart',
    authentification: 'panier',
    corps: z.object({ code: z.string().min(1) }).strict(),
    reponses: [
      { code: 200, description: 'Cart with the discount applied.', schema: cartSchema },
      erreur(404, 'Unknown coupon.'),
      erreur(409, 'Coupon not applicable — expired, minimum not reached, category missing.'),
    ],
  },
  {
    chemin: '/api/cart/coupon',
    methode: 'delete',
    resume: 'Remove the coupon',
    etiquette: 'Cart',
    authentification: 'panier',
    reponses: [{ code: 200, description: 'Cart without a discount.', schema: cartSchema }],
  },
  {
    chemin: '/api/coupons/validate',
    methode: 'post',
    resume: 'Try a coupon without applying it',
    etiquette: 'Cart',
    corps: z.object({ code: z.string().min(1) }).strict(),
    reponses: [
      { code: 200, description: 'Verdict and simulated discount.', schema: couponPreviewSchema },
      erreur(422, 'Body outside the expected schema.'),
    ],
  },
  {
    chemin: '/api/orders',
    methode: 'post',
    resume: 'Place an order',
    etiquette: 'Orders',
    authentification: 'panier',
    corps: z
      .object({
        shippingAddress: addressSchema,
        billingAddress: addressSchema.optional(),
        paymentMethod: z.enum(['carte', 'virement', 'paypal']),
      })
      .strict(),
    reponses: [
      { code: 201, description: 'Order created, access token issued.', schema: orderWithTokenSchema },
      erreur(409, 'Empty cart or insufficient stock.'),
      erreur(422, 'Body outside the expected schema.'),
    ],
  },
  {
    chemin: '/api/orders',
    methode: 'get',
    resume: 'List one’s orders',
    etiquette: 'Orders',
    authentification: 'cookie-ou-bearer',
    reponses: [
      { code: 200, description: 'The account’s orders.', schema: orderListSchema },
      erreur(401, 'Missing or invalid bearer.'),
    ],
  },
  {
    chemin: '/api/orders/{id}',
    methode: 'get',
    resume: 'Order details',
    etiquette: 'Orders',
    parametres: [parametreChemin('id', 'Order reference.', z.string())],
    reponses: [
      { code: 200, description: 'The order.', schema: orderSchema },
      erreur(403, 'Access token missing or not for this order.'),
      erreur(404, 'Unknown reference.'),
    ],
  },
];
