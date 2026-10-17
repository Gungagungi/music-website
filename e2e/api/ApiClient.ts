import { expect } from '@playwright/test';
import type { APIRequestContext, APIResponse } from '@playwright/test';
import type { ZodType } from 'zod';

import { TEST_API_TOKEN } from '@/config/env';
import type { Address } from '@/data/builders/AddressBuilder';

/**
 * Typed wrapper around Playwright's `request` fixture.
 *
 * Two jobs. First, it keeps endpoint paths and header plumbing in one file, so
 * a route rename is a one-line change rather than a sweep through the specs.
 * Second, `expectOk` folds "assert the status, parse the body, validate the
 * contract" into a single call — which is what makes it realistic to schema
 * check *every* response instead of only the ones somebody remembered to.
 */
export class ApiClient {
  private token: string | null = null;
  private cartId: string | null = null;

  constructor(private readonly request: APIRequestContext) {}

  // ---------------------------------------------------------------- session

  withToken(token: string | null): this {
    this.token = token;
    return this;
  }

  withCart(cartId: string | null): this {
    this.cartId = cartId;
    return this;
  }

  get currentCartId(): string | null {
    return this.cartId;
  }

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    const headers: Record<string, string> = { ...extra };
    if (this.token) headers.authorization = `Bearer ${this.token}`;
    if (this.cartId) headers['x-cart-id'] = this.cartId;
    return headers;
  }

  // ---------------------------------------------------------------- helpers

  /**
   * Asserts the status, then validates the body against its contract schema.
   * A schema violation fails the test with the offending path, not with a
   * downstream `undefined is not a function` three assertions later.
   */
  async expectOk<T>(response: APIResponse, schema: ZodType<T>, expectedStatus = 200): Promise<T> {
    const body: unknown = await response.json().catch(() => null);

    expect(
      response.status(),
      `${response.url()} → HTTP ${response.status()}\n${JSON.stringify(body, null, 2)}`,
    ).toBe(expectedStatus);

    const parsed = schema.safeParse(body);
    expect(
      parsed.success,
      parsed.success
        ? ''
        : `Le corps de la réponse ne respecte pas son contrat :\n${JSON.stringify(parsed.error?.issues, null, 2)}`,
    ).toBe(true);

    return (parsed.success ? parsed.data : body) as T;
  }

  // ---------------------------------------------------------------- catalog

  health(): Promise<APIResponse> {
    return this.request.get('/api/health');
  }

  products(query: Record<string, string | number | boolean | string[]> = {}): Promise<APIResponse> {
    return this.request.get('/api/products', { params: flatten(query) });
  }

  /** Bypasses `params` serialisation so malformed query strings can be tested. */
  productsRaw(queryString: string): Promise<APIResponse> {
    return this.request.get(`/api/products?${queryString}`);
  }

  product(slug: string): Promise<APIResponse> {
    return this.request.get(`/api/products/${slug}`);
  }

  categories(): Promise<APIResponse> {
    return this.request.get('/api/categories');
  }

  brands(category?: string): Promise<APIResponse> {
    return this.request.get('/api/brands', { params: category ? { category } : {} });
  }

  reviews(
    slug: string,
    params: { sort?: string; note?: number; page?: number; limit?: number } = {},
  ): Promise<APIResponse> {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) search.set(key, String(value));
    }
    const query = search.toString();
    return this.request.get(`/api/products/${slug}/reviews${query ? `?${query}` : ''}`);
  }

  createReview(
    slug: string,
    payload: { rating: number; title: string; body: string },
  ): Promise<APIResponse> {
    return this.request.post(`/api/products/${slug}/reviews`, {
      headers: this.headers(),
      data: payload,
    });
  }

  // ------------------------------------------------------------------- auth

  register(payload: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }): Promise<APIResponse> {
    return this.request.post('/api/auth/register', { data: payload });
  }

  login(payload: { email: string; password: string }): Promise<APIResponse> {
    return this.request.post('/api/auth/login', { data: payload });
  }

  me(): Promise<APIResponse> {
    return this.request.get('/api/auth/me', { headers: this.headers() });
  }

  logout(): Promise<APIResponse> {
    return this.request.post('/api/auth/logout', { headers: this.headers() });
  }

  /** Registers a unique account and keeps its token for subsequent calls. */
  async registerAndAuthenticate(payload: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }): Promise<{ token: string; userId: string }> {
    const response = await this.register(payload);
    expect(response.status(), await response.text()).toBe(201);
    const body = (await response.json()) as { token: string; user: { id: string } };
    this.withToken(body.token);
    return { token: body.token, userId: body.user.id };
  }

  // ------------------------------------------------------------------- cart

  cart(): Promise<APIResponse> {
    return this.request.get('/api/cart', { headers: this.headers() });
  }

  clearCart(): Promise<APIResponse> {
    return this.request.delete('/api/cart', { headers: this.headers() });
  }

  addToCart(payload: {
    productId?: string;
    sku?: string;
    quantity?: number;
    color?: string | null;
  }): Promise<APIResponse> {
    return this.request.post('/api/cart/items', { headers: this.headers(), data: payload });
  }

  /**
   * Adds an item and remembers the server-issued cart id, so every later call
   * from this client lands on the same cart without relying on cookies.
   */
  async addToCartAndTrack(payload: {
    productId?: string;
    sku?: string;
    quantity?: number;
    color?: string | null;
  }): Promise<{ id: string; totals: { subtotal: number; total: number; itemCount: number } }> {
    const response = await this.addToCart(payload);
    expect(response.status(), await response.text()).toBe(201);
    const cart = (await response.json()) as {
      id: string;
      totals: { subtotal: number; total: number; itemCount: number };
    };
    this.withCart(cart.id);
    return cart;
  }

  updateCartItem(itemId: string, quantity: number): Promise<APIResponse> {
    return this.request.patch(`/api/cart/items/${itemId}`, {
      headers: this.headers(),
      data: { quantity },
    });
  }

  removeCartItem(itemId: string): Promise<APIResponse> {
    return this.request.delete(`/api/cart/items/${itemId}`, { headers: this.headers() });
  }

  applyCoupon(code: string): Promise<APIResponse> {
    return this.request.post('/api/cart/coupon', { headers: this.headers(), data: { code } });
  }

  removeCoupon(): Promise<APIResponse> {
    return this.request.delete('/api/cart/coupon', { headers: this.headers() });
  }

  validateCoupon(code: string): Promise<APIResponse> {
    return this.request.post('/api/coupons/validate', { headers: this.headers(), data: { code } });
  }

  // ----------------------------------------------------------------- orders

  orders(): Promise<APIResponse> {
    return this.request.get('/api/orders', { headers: this.headers() });
  }

  order(id: string, orderToken?: string): Promise<APIResponse> {
    return this.request.get(`/api/orders/${id}`, {
      headers: this.headers(orderToken ? { 'x-order-token': orderToken } : {}),
    });
  }

  createOrder(payload: {
    email?: string;
    shippingAddress: Address;
    billingAddress?: Address;
    paymentMethod: 'carte' | 'virement' | 'paypal';
    acceptTerms: boolean;
  }): Promise<APIResponse> {
    return this.request.post('/api/orders', { headers: this.headers(), data: payload });
  }

  /** Escape hatch for negative tests that need a deliberately malformed body. */
  postRaw(path: string, data: unknown, extraHeaders: Record<string, string> = {}): Promise<APIResponse> {
    return this.request.post(path, { headers: this.headers(extraHeaders), data: data as never });
  }

  // ------------------------------------------------------------- test hooks

  resetDatabase(): Promise<APIResponse> {
    return this.request.post('/api/test/reset', {
      headers: { 'x-test-token': TEST_API_TOKEN },
    });
  }

  seed(payload: {
    users?: { email: string; password: string; firstName: string; lastName: string }[];
    stock?: { slug: string; quantity: number }[];
    carts?: { id: string; ageHours: number }[];
  }): Promise<APIResponse> {
    return this.request.post('/api/test/seed', {
      headers: { 'x-test-token': TEST_API_TOKEN },
      data: payload,
    });
  }

  subscribeToRestock(slug: string): Promise<APIResponse> {
    return this.request.post(`/api/products/${slug}/alerts`, { headers: this.headers() });
  }

  cancelRestockAlert(slug: string): Promise<APIResponse> {
    return this.request.delete(`/api/products/${slug}/alerts`, { headers: this.headers() });
  }

  myAlerts(): Promise<APIResponse> {
    return this.request.get('/api/alerts', { headers: this.headers() });
  }

  saveToWishlist(slug: string): Promise<APIResponse> {
    return this.request.post(`/api/products/${slug}/wishlist`, { headers: this.headers() });
  }

  removeFromWishlist(slug: string): Promise<APIResponse> {
    return this.request.delete(`/api/products/${slug}/wishlist`, { headers: this.headers() });
  }

  wishlist(): Promise<APIResponse> {
    return this.request.get('/api/wishlist', { headers: this.headers() });
  }

  /** Runs the restock sweep — the same function the scheduled command runs. */
  sweepRestockAlerts(): Promise<APIResponse> {
    return this.request.post('/api/test/alerts', {
      headers: { 'x-test-token': TEST_API_TOKEN },
    });
  }

  /** Runs the cart retention policy — the same function the `purge` service runs. */
  purgeCarts(): Promise<APIResponse> {
    return this.request.post('/api/test/purge', {
      headers: { 'x-test-token': TEST_API_TOKEN },
    });
  }

  serverState(): Promise<APIResponse> {
    return this.request.get('/api/test/state', { headers: { 'x-test-token': TEST_API_TOKEN } });
  }
}

function flatten(
  query: Record<string, string | number | boolean | string[]>,
): Record<string, string | number | boolean> {
  const params: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(query)) {
    // Playwright's `params` cannot repeat a key, so multi-valued facets are
    // pre-joined here; `productsRaw` covers the cases that need real repeats.
    params[key] = Array.isArray(value) ? value.join(',') : value;
  }
  return params;
}
