/**
 * Shared k6 summary handler.
 *
 * k6's default console summary is fine when you are watching a terminal. In CI
 * nobody is: the numbers have to land somewhere a reviewer will actually see
 * them. This emits a Markdown table for the GitHub job summary, a JSON file for
 * archiving, and keeps the console output for local runs.
 */

export function metric(data, name, field = 'p(95)') {
  const entry = data.metrics[name];
  if (!entry) return null;
  return entry.values[field] ?? null;
}

function formatMs(value) {
  return value === null ? 'n/a' : `${value.toFixed(0)} ms`;
}

function formatPct(value) {
  return value === null ? 'n/a' : `${(value * 100).toFixed(2)} %`;
}

function thresholdRows(data) {
  const rows = [];
  for (const [name, entry] of Object.entries(data.metrics)) {
    if (!entry.thresholds) continue;
    for (const [expression, result] of Object.entries(entry.thresholds)) {
      // k6 reports `{ ok: true }` per threshold; a failed one is what turns the
      // job red, so it belongs at the top of the report, not buried in logs.
      rows.push(`| \`${name}\` | \`${expression}\` | ${result.ok ? '✅' : '❌'} |`);
    }
  }
  return rows;
}

export function buildMarkdown(title, data) {
  const requests = data.metrics.http_reqs?.values.count ?? 0;
  const rate = data.metrics.http_reqs?.values.rate ?? 0;
  const failed = metric(data, 'http_req_failed', 'rate');
  const rows = thresholdRows(data);
  const allOk = rows.every((row) => row.includes('✅'));

  return [
    `## ${allOk ? '✅' : '❌'} ${title}`,
    '',
    `**${requests}** requêtes · **${rate.toFixed(1)}** req/s · **${formatPct(failed)}** d’échecs`,
    '',
    '| Métrique | Valeur |',
    '| --- | ---: |',
    `| Durée de requête — médiane | ${formatMs(metric(data, 'http_req_duration', 'med'))} |`,
    `| Durée de requête — p(95) | ${formatMs(metric(data, 'http_req_duration'))} |`,
    `| Durée de requête — p(99) | ${formatMs(metric(data, 'http_req_duration', 'p(99)'))} |`,
    `| Durée de requête — max | ${formatMs(metric(data, 'http_req_duration', 'max'))} |`,
    `| Taux d’échec HTTP | ${formatPct(failed)} |`,
    `| VU maximum | ${data.metrics.vus_max?.values.max ?? 'n/a'} |`,
    '',
    '### Seuils',
    '',
    '| Métrique | Seuil | Résultat |',
    '| --- | --- | :---: |',
    ...rows,
    '',
  ].join('\n');
}

/** Drop-in `handleSummary` for a k6 script. */
export function summaryHandler(title, slug) {
  return (data) => ({
    stdout: `\n${buildMarkdown(title, data)}\n`,
    [`perf/results/${slug}.json`]: JSON.stringify(data, null, 2),
    [`perf/results/${slug}.md`]: buildMarkdown(title, data),
  });
}
