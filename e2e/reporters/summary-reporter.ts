import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { FullConfig, FullResult, Reporter, Suite, TestCase } from '@playwright/test/reporter';

interface ProjectStats {
  passed: number;
  failed: number;
  flaky: number;
  skipped: number;
  durationMs: number;
}

interface FailureRecord {
  project: string;
  title: string;
  file: string;
  message: string;
}

/**
 * Writes a Markdown run summary.
 *
 * The HTML report is the right tool once you are already investigating; it is
 * the wrong tool for the first ten seconds after a pipeline goes red, when
 * somebody just wants to know *what* broke without downloading an artifact.
 * This reporter appends a table to GitHub's job summary — visible directly in
 * the Actions tab, and available on private repositories, where Pages is not.
 */
export default class SummaryReporter implements Reporter {
  private readonly stats = new Map<string, ProjectStats>();
  private readonly failures: FailureRecord[] = [];
  private readonly flakes: FailureRecord[] = [];
  private rootSuite: Suite | undefined;
  private totalTests = 0;

  onBegin(_config: FullConfig, suite: Suite): void {
    this.rootSuite = suite;
    this.totalTests = suite.allTests().length;
  }

  onEnd(result: FullResult): void {
    this.tally();
    const markdown = this.render(result);

    const localPath = 'reports/summary.md';
    mkdirSync(dirname(localPath), { recursive: true });
    writeFileSync(localPath, markdown, 'utf8');

    const githubSummary = process.env.GITHUB_STEP_SUMMARY;
    if (githubSummary) appendFileSync(githubSummary, `${markdown}\n`, 'utf8');
  }

  /**
   * Counts once per test, at the end, from `test.outcome()`.
   *
   * Counting inside `onTestEnd` looks equivalent and is not: `outcome()` is
   * derived from the results recorded so far, so a test that fails then passes
   * reports `unexpected` on the first call and `flaky` on the second. The
   * obvious guard against double-counting — comparing `result.retry` to
   * `test.results.length - 1` — is always true during a live run, because the
   * results array grows in lockstep with the retry index. The summary therefore
   * reported the same test as both a failure and a flake.
   */
  private tally(): void {
    for (const test of this.rootSuite?.allTests() ?? []) {
      const project = test.parent.project()?.name ?? 'inconnu';
      const entry = this.stats.get(project) ?? {
        passed: 0,
        failed: 0,
        flaky: 0,
        skipped: 0,
        durationMs: 0,
      };

      entry.durationMs += test.results.reduce((sum, attempt) => sum + attempt.duration, 0);

      const outcome = test.outcome();
      if (outcome === 'expected') entry.passed += 1;
      else if (outcome === 'skipped') entry.skipped += 1;
      else if (outcome === 'flaky') {
        entry.flaky += 1;
        this.flakes.push(this.describe(test, project));
      } else {
        entry.failed += 1;
        this.failures.push(this.describe(test, project));
      }

      this.stats.set(project, entry);
    }
  }

  private describe(test: TestCase, project: string): FailureRecord {
    const attempt = test.results.find((candidate) => candidate.error) ?? test.results.at(-1);
    return {
      project,
      title: test.titlePath().slice(3).join(' › '),
      file: test.location.file.split('/').slice(-2).join('/'),
      message: firstLine(attempt?.error?.message ?? 'Échec sans message.'),
    };
  }

  private render(result: FullResult): string {
    const totals = [...this.stats.values()].reduce(
      (sum, entry) => ({
        passed: sum.passed + entry.passed,
        failed: sum.failed + entry.failed,
        flaky: sum.flaky + entry.flaky,
        skipped: sum.skipped + entry.skipped,
        durationMs: sum.durationMs + entry.durationMs,
      }),
      { passed: 0, failed: 0, flaky: 0, skipped: 0, durationMs: 0 },
    );

    const icon = result.status === 'passed' ? '✅' : result.status === 'failed' ? '❌' : '⚠️';

    const lines: string[] = [
      `## ${icon} Fretline — résultats des tests`,
      '',
      // Cumulated test time, not elapsed time: the same summary is rendered
      // after a live run and after `merge-reports`, where wall clock would be
      // the duration of the merge itself — a couple of seconds, reported for a
      // suite that took a quarter of an hour across six machines.
      `**${totals.passed}/${this.totalTests}** réussis · **${totals.failed}** échecs · ` +
        `**${totals.flaky}** instables · **${totals.skipped}** ignorés · ` +
        `⏱️ ${formatDuration(totals.durationMs)} cumulés`,
      '',
      '| Projet | ✅ | ❌ | ⚠️ Instables | ⏭️ Ignorés | Durée |',
      '| --- | ---: | ---: | ---: | ---: | ---: |',
    ];

    for (const [project, entry] of [...this.stats.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      lines.push(
        `| \`${project}\` | ${entry.passed} | ${entry.failed} | ${entry.flaky} | ${entry.skipped} | ${formatDuration(entry.durationMs)} |`,
      );
    }

    appendSection(lines, '### Échecs', this.failures);

    // Flakes are surfaced separately rather than folded into the failure list.
    // A green pipeline that quietly retried its way past an unstable test is
    // how a suite stops being trusted; naming them keeps the debt visible.
    appendSection(lines, '### Instables (réussis après relance)', this.flakes);

    lines.push('', '_Rapport HTML complet et traces disponibles dans les artifacts du job._');
    return lines.join('\n');
  }
}

function appendSection(lines: string[], heading: string, records: FailureRecord[]): void {
  if (records.length === 0) return;

  lines.push('', heading, '');
  for (const record of records.slice(0, 20)) {
    lines.push(`- **\`${record.project}\`** · ${record.file} — ${record.title}`);
    lines.push(`  > ${record.message}`);
  }
  if (records.length > 20) {
    lines.push('', `_…et ${records.length - 20} autres (voir le rapport HTML)._`);
  }
}

function formatDuration(ms: number): string {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds} s`;
  return `${Math.floor(seconds / 60)} min ${String(seconds % 60).padStart(2, '0')} s`;
}

function firstLine(message: string): string {
  // eslint-disable-next-line no-control-regex
  return message.replace(/\u001b\[\d+m/g, '').split('\n')[0]?.slice(0, 220) ?? '';
}
