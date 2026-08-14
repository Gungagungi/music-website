import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestResult,
} from '@playwright/test/reporter';

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
  private startedAt = 0;
  private totalTests = 0;

  onBegin(_config: FullConfig, suite: Suite): void {
    this.startedAt = Date.now();
    this.totalTests = suite.allTests().length;
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    const project = test.parent.project()?.name ?? 'inconnu';
    const entry = this.stats.get(project) ?? {
      passed: 0,
      failed: 0,
      flaky: 0,
      skipped: 0,
      durationMs: 0,
    };
    entry.durationMs += result.duration;

    switch (test.outcome()) {
      case 'expected':
        // A retried test that eventually passed is counted once, on its last run.
        if (result.retry === test.results.length - 1) entry.passed += 1;
        break;
      case 'flaky':
        if (result.retry === test.results.length - 1) entry.flaky += 1;
        break;
      case 'unexpected':
        if (result.retry === test.results.length - 1) {
          entry.failed += 1;
          this.failures.push({
            project,
            title: test.titlePath().slice(3).join(' › '),
            file: test.location.file.split('/').slice(-2).join('/'),
            message: firstLine(result.error?.message ?? 'Échec sans message.'),
          });
        }
        break;
      case 'skipped':
        entry.skipped += 1;
        break;
    }

    this.stats.set(project, entry);
  }

  onEnd(result: FullResult): void {
    const markdown = this.render(result);

    const localPath = 'reports/summary.md';
    mkdirSync(dirname(localPath), { recursive: true });
    writeFileSync(localPath, markdown, 'utf8');

    const githubSummary = process.env.GITHUB_STEP_SUMMARY;
    if (githubSummary) appendFileSync(githubSummary, `${markdown}\n`, 'utf8');
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
    const wallClock = formatDuration(Date.now() - this.startedAt);

    const lines: string[] = [
      `## ${icon} Fretline — résultats des tests`,
      '',
      `**${totals.passed}/${this.totalTests}** réussis · **${totals.failed}** échecs · ` +
        `**${totals.flaky}** instables · **${totals.skipped}** ignorés · ⏱️ ${wallClock}`,
      '',
      '| Projet | ✅ | ❌ | ⚠️ Instables | ⏭️ Ignorés | Durée |',
      '| --- | ---: | ---: | ---: | ---: | ---: |',
    ];

    for (const [project, entry] of [...this.stats.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      lines.push(
        `| \`${project}\` | ${entry.passed} | ${entry.failed} | ${entry.flaky} | ${entry.skipped} | ${formatDuration(entry.durationMs)} |`,
      );
    }

    if (this.failures.length > 0) {
      lines.push('', '### Échecs', '');
      for (const failure of this.failures.slice(0, 20)) {
        lines.push(`- **\`${failure.project}\`** · ${failure.file} — ${failure.title}`);
        lines.push(`  > ${failure.message}`);
      }
      if (this.failures.length > 20) {
        lines.push('', `_…et ${this.failures.length - 20} autres échecs (voir le rapport HTML)._`);
      }
    }

    lines.push('', '_Rapport HTML complet et traces disponibles dans les artifacts du job._');
    return lines.join('\n');
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
