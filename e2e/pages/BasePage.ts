import type { Page, Response } from '@playwright/test';

import { HeaderComponent } from '@/pages/components/HeaderComponent';

/**
 * Base for every page object.
 *
 * Page objects here expose **locators and actions**, not assertions. Keeping
 * expectations in the spec is what lets the same page object serve a happy path,
 * a negative case and an accessibility scan without growing a method per
 * assertion — and it keeps failure messages pointing at the test's intent
 * rather than at a helper three files away.
 */
export abstract class BasePage {
  readonly header: HeaderComponent;

  protected constructor(protected readonly page: Page) {
    this.header = new HeaderComponent(page);
  }

  /** Path this page lives at, used by `open()`. */
  protected abstract path(): string;

  async open(query: Record<string, string | string[]> = {}): Promise<Response | null> {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      for (const entry of Array.isArray(value) ? value : [value]) search.append(key, entry);
    }
    const suffix = search.toString() ? `?${search}` : '';
    const response = await this.page.goto(`${this.path()}${suffix}`);
    await this.waitForHydration();
    return response;
  }

  /**
   * Blocks until the page is actually interactive.
   *
   * `load` and `domcontentloaded` both fire on server-rendered markup whose
   * event handlers are not attached yet and whose controlled inputs will be
   * reset by React's first render. Acting inside that window is how a coupon
   * form submitted an empty code on WebKit while the field visibly held the
   * value a moment earlier — the check passed, hydration landed, the state won.
   *
   * The application publishes an explicit readiness attribute for this, so the
   * wait is on a real signal rather than on a duration guessed to be long
   * enough on the machine it was written on.
   */
  async waitForHydration(): Promise<void> {
    await this.page.locator('html[data-hydrated="true"]').waitFor({ state: 'attached' });
  }

  get currentUrl(): URL {
    return new URL(this.page.url());
  }

  /** Reads a query parameter from the current URL — facets store their state there. */
  searchParam(name: string): string | null {
    return this.currentUrl.searchParams.get(name);
  }

  searchParamAll(name: string): string[] {
    return this.currentUrl.searchParams.getAll(name);
  }

  get title() {
    return this.page.getByRole('heading', { level: 1 });
  }
}
