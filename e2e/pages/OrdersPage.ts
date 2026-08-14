import type { Locator, Page } from '@playwright/test';

import { BasePage } from '@/pages/BasePage';

export class OrdersPage extends BasePage {
  readonly heading: Locator;
  readonly accountEmail: Locator;
  readonly orders: Locator;
  readonly emptyState: Locator;
  readonly logout: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByTestId('orders-title');
    this.accountEmail = page.getByTestId('account-email');
    this.orders = page.getByTestId('order-item');
    this.emptyState = page.getByTestId('empty-orders');
    this.logout = page.getByTestId('logout-button');
  }

  protected path(): string {
    return '/compte/commandes';
  }

  orderByReference(reference: string): Locator {
    return this.page.locator(`[data-testid="order-item"][data-reference="${reference}"]`);
  }

  async references(): Promise<string[]> {
    return this.orders.evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute('data-reference') ?? ''),
    );
  }
}
