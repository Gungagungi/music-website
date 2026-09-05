/** Domain model shared by the storefront pages and the REST API. */

export const CATEGORY_SLUGS = [
  'guitares-electriques',
  'guitares-acoustiques',
  'guitares-classiques',
  'basses-electriques',
  'amplis-guitare',
  'amplis-basse',
  'pedales-effets',
  'cordes',
  'accessoires',
] as const;

export type CategorySlug = (typeof CATEGORY_SLUGS)[number];

export interface Category {
  slug: CategorySlug;
  label: string;
  group: 'Guitares' | 'Basses' | 'Amplification' | 'Accessoires';
  tagline: string;
}

export interface Product {
  id: string;
  sku: string;
  slug: string;
  name: string;
  brand: string;
  category: CategorySlug;
  /** Price in cents, VAT included. See lib/money.ts. */
  price: number;
  /** Pre-discount price in cents, or null when the product is not discounted. */
  listPrice: number | null;
  discountPct: number;
  currency: 'EUR';
  stock: number;
  rating: number;
  reviewCount: number;
  releasedAt: string;
  bestSeller: boolean;
  isNew: boolean;
  leftHanded: boolean;
  colors: string[];
  specs: Record<string, string>;
  description: string;
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  /** `${salt}:${scryptHash}` — never leaves the server. */
  passwordHash: string;
  createdAt: string;
}

export type PublicUser = Omit<User, 'passwordHash'>;

export interface CartItem {
  id: string;
  productId: string;
  sku: string;
  slug: string;
  name: string;
  brand: string;
  color: string | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface CartTotals {
  /** Sum of line totals, VAT included, in cents. */
  subtotal: number;
  /** Coupon discount in cents (positive number). */
  discount: number;
  shipping: number;
  /** VAT portion already contained in `total`, in cents. */
  vat: number;
  total: number;
  itemCount: number;
}

export interface Cart {
  id: string;
  userId: string | null;
  items: CartItem[];
  couponCode: string | null;
  totals: CartTotals;
  updatedAt: string;
}

export interface Coupon {
  code: string;
  /** `percent` discounts a share of the subtotal, `fixed` a flat amount in cents. */
  type: 'percent' | 'fixed';
  value: number;
  minSubtotal: number;
  category: CategorySlug | null;
  expiresAt: string | null;
  description: string;
}

export interface Address {
  firstName: string;
  lastName: string;
  line1: string;
  line2?: string | null;
  postalCode: string;
  city: string;
  country: string;
  phone?: string | null;
}

export type OrderStatus = 'confirmee' | 'en_preparation' | 'expediee' | 'livree' | 'annulee';

export type PaymentMethod = 'carte' | 'virement' | 'paypal';

export interface Order {
  id: string;
  reference: string;
  userId: string | null;
  email: string;
  items: CartItem[];
  totals: CartTotals;
  couponCode: string | null;
  shippingAddress: Address;
  billingAddress: Address;
  paymentMethod: PaymentMethod;
  status: OrderStatus;
  createdAt: string;
  /** Returned once at creation so a guest can fetch their own order. */
  accessToken: string;
}

export interface Review {
  id: string;
  productId: string;
  userId: string | null;
  author: string;
  rating: number;
  title: string;
  body: string;
  createdAt: string;
  /**
   * Snapshot, taken when the review is published: did that customer already own
   * the product? Recomputing it at read time would let a later order rewrite the
   * badge on an old review, and the badge claims something about the moment the
   * opinion was written.
   */
  verifiedPurchase: boolean;
}

export type ReviewSortKey = 'recents' | 'anciens' | 'note-desc' | 'note-asc';

export const REVIEW_SORT_KEYS = ['recents', 'anciens', 'note-desc', 'note-asc'] as const;

export interface ReviewQuery {
  sort?: ReviewSortKey;
  /** Keeps only the reviews carrying exactly that many stars. */
  rating?: number;
  page?: number;
  limit?: number;
}

/** Count of stored reviews per star level, always five entries, 5 down to 1. */
export type RatingHistogram = Record<1 | 2 | 3 | 4 | 5, number>;

export interface ReviewPage extends Paginated<Review> {
  /**
   * Computed over *every* stored review of the product, not over the current
   * page, and never over the filtered subset — a histogram that redrew itself
   * to match the filter would stop being the thing you filter with.
   */
  histogram: RatingHistogram;
  /** Total number of stored reviews, filter-independent, for the same reason. */
  storedCount: number;
}

export type SortKey = 'pertinence' | 'prix-asc' | 'prix-desc' | 'note' | 'nouveautes';

export interface ProductQuery {
  category?: CategorySlug;
  brands?: string[];
  minPrice?: number;
  maxPrice?: number;
  q?: string;
  inStock?: boolean;
  leftHanded?: boolean;
  minRating?: number;
  onSale?: boolean;
  sort?: SortKey;
  page?: number;
  limit?: number;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
