#!/usr/bin/env node
/**
 * Appends a run to the trend history.
 *
 * Each run produces its own snapshot: how many tests, how many failures, how
 * many flaky ones, how long. None of them says whether the suite has been
 * slowing down for three weeks, or whether a test is becoming flaky one time in
 * ten — which is nevertheless the only way to see drift coming rather than
 * suffering it. That takes a memory, and a per-run report has none.
 *
 * The format is JSON Lines: one line per run, appended at the end. Two runs
 * writing at the same time produce at worst two lines out of order, never an
 * unreadable file — which a JSON file rewritten every time does not guarantee.
 *
 *   node scripts/enregistrer-tendance.mjs <summary.json> <history.jsonl>
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const [resumeArg, historiqueArg] = process.argv.slice(2);
if (!resumeArg || !historiqueArg) {
  console.error('Usage: node scripts/enregistrer-tendance.mjs <summary.json> <history.jsonl>');
  process.exit(1);
}

const resume = resolve(resumeArg);
const historique = resolve(historiqueArg);

if (!existsSync(resume)) {
  console.error(`Summary not found: ${resume}. The run produced nothing to record.`);
  process.exit(1);
}

const { statut, total, totaux, projets, instables } = JSON.parse(readFileSync(resume, 'utf8'));

// The flaky rate is relative to the tests executed, not to the total: counting
// skipped tests in the denominator would lower the rate by disabling tests.
const executes = totaux.passed + totaux.failed + totaux.flaky;
const tauxInstables = executes === 0 ? 0 : Number((totaux.flaky / executes).toFixed(4));

const ligne = {
  date: new Date().toISOString(),
  commit: process.env.GITHUB_SHA?.slice(0, 7) ?? null,
  run: process.env.GITHUB_RUN_ID ?? null,
  declencheur: process.env.GITHUB_EVENT_NAME ?? 'local',
  statut,
  total,
  reussis: totaux.passed,
  echoues: totaux.failed,
  instables: totaux.flaky,
  ignores: totaux.skipped,
  tauxInstables,
  dureeMs: totaux.durationMs,
  projets: Object.fromEntries(
    Object.entries(projets).map(([nom, stats]) => [nom, { dureeMs: stats.durationMs, instables: stats.flaky }]),
  ),
  testsInstables: instables,
};

mkdirSync(dirname(historique), { recursive: true });
appendFileSync(historique, `${JSON.stringify(ligne)}\n`, 'utf8');

console.log(
  `Run recorded: ${ligne.reussis}/${ligne.total} passed · ${ligne.instables} flaky ` +
    `(${(tauxInstables * 100).toFixed(2)} %) · ${Math.round(ligne.dureeMs / 1000)} s cumulative`,
);
