import { z } from 'zod';

import { CATEGORY_SLUGS } from '@/lib/types';

/** Query string values always arrive as strings; these helpers keep coercion explicit. */
const numeric = z.coerce.number();
const boolish = z
  .enum(['true', 'false', '1', '0'])
  .transform((value) => value === 'true' || value === '1');

export const productQuerySchema = z.object({
  category: z.enum(CATEGORY_SLUGS).optional(),
  brand: z.union([z.string(), z.array(z.string())]).optional(),
  minPrice: numeric.int().min(0).optional(),
  maxPrice: numeric.int().min(0).optional(),
  q: z.string().trim().max(120).optional(),
  inStock: boolish.optional(),
  leftHanded: boolish.optional(),
  minRating: numeric.min(0).max(5).optional(),
  onSale: boolish.optional(),
  sort: z.enum(['pertinence', 'prix-asc', 'prix-desc', 'note', 'nouveautes']).optional(),
  page: numeric.int().min(1).optional(),
  limit: numeric.int().min(1).max(100).optional(),
});

export const passwordSchema = z
  .string()
  .min(8, 'Le mot de passe doit contenir au moins 8 caractères.')
  .regex(/[0-9]/, 'Le mot de passe doit contenir au moins un chiffre.')
  .regex(/[A-Za-z]/, 'Le mot de passe doit contenir au moins une lettre.');

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email('Adresse e-mail invalide.'),
  password: passwordSchema,
  firstName: z.string().trim().min(1, 'Le prénom est obligatoire.').max(60),
  lastName: z.string().trim().min(1, 'Le nom est obligatoire.').max(60),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Adresse e-mail invalide.'),
  password: z.string().min(1, 'Le mot de passe est obligatoire.'),
});

export const addItemSchema = z
  .object({
    productId: z.string().trim().optional(),
    sku: z.string().trim().optional(),
    quantity: z.number().int().min(1, 'La quantité doit être au moins 1.').max(10).default(1),
    color: z.string().trim().max(60).nullable().optional(),
  })
  .refine((value) => Boolean(value.productId ?? value.sku), {
    message: 'Indiquez productId ou sku.',
    path: ['productId'],
  });

export const updateItemSchema = z.object({
  quantity: z.number().int().min(0, 'La quantité ne peut pas être négative.').max(10),
});

export const couponSchema = z.object({
  code: z.string().trim().min(1, 'Le code promo est obligatoire.').max(40),
});

export const addressSchema = z.object({
  firstName: z.string().trim().min(1, 'Le prénom est obligatoire.').max(60),
  lastName: z.string().trim().min(1, 'Le nom est obligatoire.').max(60),
  line1: z.string().trim().min(1, 'L’adresse est obligatoire.').max(120),
  line2: z.string().trim().max(120).nullable().optional(),
  postalCode: z
    .string()
    .trim()
    .regex(/^\d{5}$/, 'Le code postal doit comporter 5 chiffres.'),
  city: z.string().trim().min(1, 'La ville est obligatoire.').max(80),
  country: z.string().trim().min(2).max(60).default('France'),
  phone: z
    .string()
    .trim()
    .regex(/^(?:\+33|0)[1-9](?:[\s.-]?\d{2}){4}$/, 'Numéro de téléphone invalide.')
    .nullable()
    .optional(),
});

export const createOrderSchema = z.object({
  email: z.string().trim().toLowerCase().email('Adresse e-mail invalide.').optional(),
  shippingAddress: addressSchema,
  billingAddress: addressSchema.optional(),
  paymentMethod: z.enum(['carte', 'virement', 'paypal']),
  acceptTerms: z
    .boolean()
    .refine((value) => value, { message: 'Vous devez accepter les conditions générales de vente.' }),
});

export const createReviewSchema = z.object({
  rating: z.number().int().min(1, 'La note doit être comprise entre 1 et 5.').max(5),
  title: z.string().trim().min(3, 'Le titre doit contenir au moins 3 caractères.').max(100),
  body: z.string().trim().min(10, 'Le commentaire doit contenir au moins 10 caractères.').max(2000),
});
