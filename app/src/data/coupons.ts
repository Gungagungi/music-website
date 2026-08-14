import type { Coupon } from '@/lib/types';

/**
 * Seeded coupons. The set deliberately covers every branch the validation code
 * can take — that is what makes the coupon test suite worth writing.
 */
export const COUPONS: Coupon[] = [
  {
    code: 'BIENVENUE10',
    type: 'percent',
    value: 10,
    minSubtotal: 5000,
    category: null,
    expiresAt: null,
    description: '10 % de remise dès 50 € d’achat',
  },
  {
    code: 'CORDES5',
    type: 'fixed',
    value: 500,
    minSubtotal: 0,
    category: 'cordes',
    expiresAt: null,
    description: '5 € de remise sur les cordes',
  },
  {
    code: 'GROSPANIER50',
    type: 'fixed',
    value: 5000,
    minSubtotal: 50000,
    category: null,
    expiresAt: null,
    description: '50 € de remise dès 500 € d’achat',
  },
  {
    code: 'NOEL2020',
    type: 'percent',
    value: 20,
    minSubtotal: 0,
    category: null,
    expiresAt: '2020-12-31',
    description: 'Offre de Noël 2020 (expirée)',
  },
];
