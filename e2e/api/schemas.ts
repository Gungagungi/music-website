import { z } from 'zod';

/**
 * Contract schemas.
 *
 * Status codes and a handful of field values are the *behaviour* of the API;
 * these schemas describe its *shape*. Validating every response against them
 * catches the class of regression that assertions never do — a field silently
 * renamed, a number that became a string, a nullable that stopped being
 * nullable — without anybody having to write a test for each field.
 *
 * `.strict()` is deliberate: an unexpected extra key is a finding, not noise.
 * It is how you notice that `passwordHash` started leaking out of `/api/auth/me`.
 */

export const categorySlugSchema = z.enum([
  'guitares-electriques',
  'guitares-acoustiques',
  'guitares-classiques',
  'basses-electriques',
  'amplis-guitare',
  'amplis-basse',
  'pedales-effets',
  'cordes',
  'accessoires',
]);

export const productSchema = z
  .object({
    id: z.string().regex(/^PRD-\d{4}$/),
    sku: z.string().min(1),
    slug: z.string().min(1),
    name: z.string().min(1),
    brand: z.string().min(1),
    category: categorySlugSchema,
    price: z.number().int().nonnegative(),
    listPrice: z.number().int().positive().nullable(),
    discountPct: z.number().int().min(0).max(100),
    currency: z.literal('EUR'),
    stock: z.number().int().nonnegative(),
    rating: z.number().min(0).max(5),
    reviewCount: z.number().int().nonnegative(),
    releasedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    bestSeller: z.boolean(),
    isNew: z.boolean(),
    leftHanded: z.boolean(),
    colors: z.array(z.string()).min(1),
    specs: z.record(z.string(), z.string()),
    description: z.string().min(1),
  })
  .strict();

export const reviewSchema = z
  .object({
    id: z.string().min(1),
    productId: z.string().min(1),
    userId: z.string().nullable(),
    author: z.string().min(1),
    rating: z.number().int().min(1).max(5),
    title: z.string().min(1),
    body: z.string().min(1),
    createdAt: z.string().datetime(),
  })
  .strict();

export const productDetailSchema = productSchema.extend({
  reviews: z.array(reviewSchema),
});

export const paginatedProductsSchema = z
  .object({
    items: z.array(productSchema),
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().positive(),
  })
  .strict();

export const categoryListSchema = z
  .object({
    items: z.array(
      z
        .object({
          slug: categorySlugSchema,
          label: z.string().min(1),
          group: z.enum(['Guitares', 'Basses', 'Amplification', 'Accessoires']),
          tagline: z.string().min(1),
          productCount: z.number().int().nonnegative(),
        })
        .strict(),
    ),
  })
  .strict();

export const brandListSchema = z
  .object({
    items: z.array(
      z.object({ name: z.string().min(1), count: z.number().int().positive() }).strict(),
    ),
  })
  .strict();

export const publicUserSchema = z
  .object({
    id: z.string().regex(/^USR-\d{4}$/),
    email: z.string().email(),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    createdAt: z.string().datetime(),
  })
  .strict();

export const authResponseSchema = z
  .object({
    user: publicUserSchema,
    token: z.string().min(20),
  })
  .strict();

export const cartItemSchema = z
  .object({
    id: z.string().uuid(),
    productId: z.string().min(1),
    sku: z.string().min(1),
    slug: z.string().min(1),
    name: z.string().min(1),
    brand: z.string().min(1),
    color: z.string().nullable(),
    unitPrice: z.number().int().nonnegative(),
    quantity: z.number().int().positive(),
    lineTotal: z.number().int().nonnegative(),
  })
  .strict();

export const cartTotalsSchema = z
  .object({
    subtotal: z.number().int().nonnegative(),
    discount: z.number().int().nonnegative(),
    shipping: z.number().int().nonnegative(),
    vat: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
    itemCount: z.number().int().nonnegative(),
  })
  .strict();

export const cartSchema = z
  .object({
    id: z.string().min(1),
    userId: z.string().nullable(),
    items: z.array(cartItemSchema),
    couponCode: z.string().nullable(),
    totals: cartTotalsSchema,
    updatedAt: z.string().datetime(),
  })
  .strict();

export const addressSchema = z
  .object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    line1: z.string().min(1),
    line2: z.string().nullable().optional(),
    postalCode: z.string().regex(/^\d{5}$/),
    city: z.string().min(1),
    country: z.string().min(1),
    phone: z.string().nullable().optional(),
  })
  .strict();

const orderCoreSchema = z.object({
  id: z.string().uuid(),
  reference: z.string().regex(/^FRT-\d{6}$/),
  userId: z.string().nullable(),
  email: z.string().email(),
  items: z.array(cartItemSchema).min(1),
  totals: cartTotalsSchema,
  couponCode: z.string().nullable(),
  shippingAddress: addressSchema,
  billingAddress: addressSchema,
  paymentMethod: z.enum(['carte', 'virement', 'paypal']),
  status: z.enum(['confirmee', 'en_preparation', 'expediee', 'livree', 'annulee']),
  createdAt: z.string().datetime(),
});

/** Creation is the only response that carries the one-time guest access token. */
export const orderWithTokenSchema = orderCoreSchema.extend({ accessToken: z.string().uuid() }).strict();

export const orderSchema = orderCoreSchema.strict();

export const orderListSchema = z
  .object({
    items: z.array(orderSchema),
    total: z.number().int().nonnegative(),
  })
  .strict();

export const apiErrorSchema = z
  .object({
    error: z
      .object({
        code: z.string().min(1),
        message: z.string().min(1),
        details: z
          .array(z.object({ field: z.string(), message: z.string() }).strict())
          .optional(),
      })
      .strict(),
  })
  .strict();

export const healthSchema = z
  .object({
    status: z.literal('ok'),
    version: z.string().min(1),
    uptimeSeconds: z.number().int().nonnegative(),
    products: z.number().int().positive(),
    testMode: z.boolean(),
    seededBugs: z.boolean(),
  })
  .strict();

/** `GET /api/test/state` — server state no UI exposes. */
export const serverStateSchema = z
  .object({
    products: z.number().int().nonnegative(),
    users: z.number().int().nonnegative(),
    carts: z.number().int().nonnegative(),
    orders: z.number().int().nonnegative(),
    reviews: z.number().int().nonnegative(),
    counters: z
      .object({
        order: z.number().int().nonnegative(),
        user: z.number().int().nonnegative(),
      })
      .strict(),
  })
  .strict();

/** `POST /api/test/purge` — what the retention policy deleted, by rule. */
export const purgeSummarySchema = z
  .object({
    emptyCarts: z.number().int().nonnegative(),
    guestCarts: z.number().int().nonnegative(),
    dormantAccountCarts: z.number().int().nonnegative(),
  })
  .strict();

export const couponPreviewSchema = z
  .object({
    code: z.string().min(1),
    description: z.string().min(1),
    discount: z.number().int().nonnegative(),
  })
  .strict();

export type Product = z.infer<typeof productSchema>;
export type Cart = z.infer<typeof cartSchema>;
export type Order = z.infer<typeof orderWithTokenSchema>;
export type PublicUser = z.infer<typeof publicUserSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;
