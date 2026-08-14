import type { Page } from '@playwright/test';

/**
 * Prepares a page for screenshot comparison.
 *
 * Visual regression only earns its keep if a diff means "something changed",
 * not "the clock moved". Everything that varies between two otherwise identical
 * runs is neutralised here: caret blink, transitions, smooth scrolling, and the
 * lazy-loading that leaves images half-painted when the screenshot fires.
 */
export async function stabilise(page: Page): Promise<void> {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
        caret-color: transparent !important;
        scroll-behavior: auto !important;
      }
    `,
  });

  // Force every lazy image to decode before the capture.
  await page.evaluate(async () => {
    const images = Array.from(document.images);
    for (const image of images) image.loading = 'eager';
    await Promise.all(
      images.filter((image) => !image.complete).map(
        (image) =>
          new Promise<void>((resolve) => {
            image.addEventListener('load', () => resolve(), { once: true });
            image.addEventListener('error', () => resolve(), { once: true });
          }),
      ),
    );
    await document.fonts.ready;
  });
}
