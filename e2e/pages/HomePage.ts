import type { Locator, Page } from '@playwright/test';

import { BasePage } from '@/pages/BasePage';
import { ProductCardComponent } from '@/pages/components/ProductCardComponent';

export class HomePage extends BasePage {
  readonly hero: Locator;
  readonly heroPrimaryCta: Locator;
  readonly heroSecondaryCta: Locator;
  readonly categoryTiles: Locator;
  readonly bestSellers: Locator;
  readonly newArrivals: Locator;
  readonly hotDeals: Locator;

  constructor(page: Page) {
    super(page);
    this.hero = page.getByTestId('hero');
    this.heroPrimaryCta = page.getByTestId('hero-cta-primary');
    this.heroSecondaryCta = page.getByTestId('hero-cta-secondary');
    this.categoryTiles = page.getByTestId('category-tiles');
    this.bestSellers = page.getByTestId('section-best-sellers');
    this.newArrivals = page.getByTestId('section-new-arrivals');
    this.hotDeals = page.getByTestId('section-hot-deals');
  }

  protected path(): string {
    return '/';
  }

  categoryTile(slug: string): Locator {
    return this.page.getByTestId(`category-tile-${slug}`);
  }

  cardsIn(section: 'best-sellers' | 'new-arrivals' | 'hot-deals'): Locator {
    return this.page.getByTestId(`grid-${section}`).getByTestId('product-card');
  }

  firstCardIn(section: 'best-sellers' | 'new-arrivals' | 'hot-deals'): ProductCardComponent {
    return new ProductCardComponent(this.cardsIn(section).first());
  }
}
