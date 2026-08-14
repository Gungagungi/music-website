import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import type { Result } from 'axe-core';

/**
 * Accessibility scanning helper.
 *
 * Two design choices worth stating. First, the scan is scoped to WCAG 2.1 A/AA
 * — the level European accessibility obligations actually reference, rather
 * than "every rule axe knows", which drowns real findings in best-practice
 * noise. Second, violations are reported with the offending selector and a
 * documentation link: an a11y failure that just says "colour-contrast" is a
 * ticket nobody can action.
 */
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

export interface ScanOptions {
  /** CSS selector to restrict the scan to a region. */
  include?: string;
  /** Selectors to leave out — third-party widgets, or a known open defect. */
  exclude?: string[];
  /** Rule ids to disable, always with a reason in the calling spec. */
  disableRules?: string[];
}

export async function scanForViolations(page: Page, options: ScanOptions = {}): Promise<Result[]> {
  let builder = new AxeBuilder({ page }).withTags(WCAG_TAGS);

  if (options.include) builder = builder.include(options.include);
  for (const selector of options.exclude ?? []) builder = builder.exclude(selector);
  if (options.disableRules?.length) builder = builder.disableRules(options.disableRules);

  const results = await builder.analyze();
  return results.violations;
}

/** Renders violations as a readable failure message. */
export function formatViolations(violations: Result[]): string {
  if (violations.length === 0) return 'Aucune violation détectée.';

  return violations
    .map((violation) => {
      const targets = violation.nodes
        .slice(0, 5)
        .map((node) => `      → ${node.target.join(' ')}`)
        .join('\n');
      const extra =
        violation.nodes.length > 5 ? `\n      … et ${violation.nodes.length - 5} autres éléments` : '';

      return [
        `  [${violation.impact ?? 'n/a'}] ${violation.id} — ${violation.help}`,
        `    ${violation.helpUrl}`,
        targets + extra,
      ].join('\n');
    })
    .join('\n\n');
}

/** Keeps only violations at or above a severity threshold. */
export function atLeast(violations: Result[], impact: 'minor' | 'moderate' | 'serious' | 'critical'): Result[] {
  const order = ['minor', 'moderate', 'serious', 'critical'];
  const threshold = order.indexOf(impact);
  return violations.filter((violation) => order.indexOf(violation.impact ?? 'minor') >= threshold);
}
