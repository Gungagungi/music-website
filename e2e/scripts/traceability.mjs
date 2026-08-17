#!/usr/bin/env node
/**
 * Derives the traceability artefacts from the test suite itself.
 *
 * A matrix maintained by hand is a matrix that is wrong. It starts accurate,
 * survives two sprints, and then quietly describes a suite that no longer
 * exists — at which point it is worse than having none, because people still
 * trust it. So the mapping is read from the `testCase()` / `covers()`
 * annotations Playwright already carries, and `--check` fails CI when the
 * committed files no longer match the code.
 *
 * Usage:
 *   node scripts/traceability.mjs           # regenerate docs/
 *   node scripts/traceability.mjs --check   # verify they are up to date
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const E2E_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DOCS_DIR = resolve(E2E_DIR, '..', 'docs');

// One project per axis. Listing every browser would triple every row without
// adding a single new fact: the same spec is the same requirement coverage
// whichever engine runs it.
const PROJECTS = ['api', 'chromium', 'a11y', 'visual'];

// Paths reported by `--list` are relative to `testDir`, so the setup projects
// show up as `../setup/...` — those are plumbing, not coverage.
const SUITE_BY_PREFIX = [
  ['api/', 'API'],
  ['ui/', 'UI'],
  ['a11y/', 'Accessibility'],
  ['visual/', 'Visual'],
];

function listSpecs() {
  const raw = execFileSync(
    'npx',
    ['playwright', 'test', '--list', '--reporter=json', ...PROJECTS.map((p) => `--project=${p}`)],
    { cwd: E2E_DIR, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  const report = JSON.parse(raw);

  const specs = [];
  const walk = (node, titles) => {
    for (const child of node.suites ?? []) walk(child, [...titles, child.title ?? '']);
    for (const spec of node.specs ?? []) specs.push({ spec, titles, file: spec.file ?? node.file });
  };
  for (const file of report.suites ?? []) walk(file, [file.title ?? '']);

  const rows = [];
  for (const { spec, titles, file } of specs) {
    if (file.startsWith('../')) continue;

    const test = spec.tests[0];
    const annotations = test?.annotations ?? [];
    const testCase = annotations.find((a) => a.type === 'test-case')?.description ?? '';
    const [id, name = ''] = splitAnnotation(testCase);

    rows.push({
      id,
      name,
      file,
      suite: SUITE_BY_PREFIX.find(([prefix]) => file.startsWith(prefix))?.[1] ?? 'Other',
      group: titles.slice(1).filter(Boolean).join(' › '),
      title: spec.title,
      // Tags hang off the spec, not the test — `test.tags` is always empty here.
      tags: (spec.tags ?? []).map((tag) => (tag.startsWith('@') ? tag : `@${tag}`)).sort(),
      requirements: annotations.filter((a) => a.type === 'requirement').map((a) => a.description),
      knownBug: splitAnnotation(
        annotations.find((a) => a.type === 'known-bug')?.description ?? '',
      )[0],
    });
  }

  return rows.sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }));
}

function splitAnnotation(value) {
  const [id, ...rest] = value.split(' — ');
  return [id ?? '', rest.join(' — ')];
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function buildCsv(rows) {
  const header = [
    'test_case_id',
    'name',
    'suite',
    'group',
    'automated_test',
    'spec_file',
    'tags',
    'requirements',
    'known_bug',
  ];
  const lines = [header.join(',')];
  for (const row of rows) {
    lines.push(
      [
        row.id,
        row.name,
        row.suite,
        row.group,
        row.title,
        row.file,
        row.tags.join(' '),
        row.requirements.join(' '),
        row.knownBug,
      ]
        .map(csvCell)
        .join(','),
    );
  }
  return `${lines.join('\n')}\n`;
}

function requirementKey(id) {
  const [family, number] = [id.slice(0, id.lastIndexOf('-')), id.slice(id.lastIndexOf('-') + 1)];
  return [family, Number.parseInt(number, 10) || 0];
}

function buildMatrix(rows) {
  const byRequirement = new Map();
  for (const row of rows) {
    for (const requirement of row.requirements) {
      if (!byRequirement.has(requirement)) byRequirement.set(requirement, []);
      byRequirement.get(requirement).push(row);
    }
  }

  const requirements = [...byRequirement.keys()].sort((a, b) => {
    const [famA, numA] = requirementKey(a);
    const [famB, numB] = requirementKey(b);
    return famA === famB ? numA - numB : famA.localeCompare(famB);
  });

  const untraced = rows.filter((row) => row.requirements.length === 0);
  const counts = rows.reduce((acc, row) => acc.set(row.suite, (acc.get(row.suite) ?? 0) + 1), new Map());

  const out = [
    '# Traceability matrix',
    '',
    '<!-- GENERATED FILE — run `npm run trace -w e2e` to refresh. Do not edit by hand. -->',
    '',
    'Every row is derived from the `covers()` and `testCase()` annotations carried by the',
    'specs themselves, so this file cannot drift from the suite: CI regenerates it and fails',
    'if the committed copy differs.',
    '',
    '## Summary',
    '',
    '| | |',
    '| --- | ---: |',
    `| Requirements covered | ${requirements.length} |`,
    `| Automated test cases | ${rows.length} |`,
    ...[...counts.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([suite, count]) => `| — ${suite} | ${count} |`),
    `| Test cases without a requirement | ${untraced.length} |`,
    '',
    '## Requirement → test cases',
    '',
    '| Requirement | Test cases | Suite | Tags |',
    '| --- | --- | --- | --- |',
  ];

  for (const requirement of requirements) {
    const covering = byRequirement.get(requirement);
    const ids = covering.map((row) => `\`${row.id}\``).join(', ');
    const suites = [...new Set(covering.map((row) => row.suite))].join(', ');
    const tags = [...new Set(covering.flatMap((row) => row.tags))].sort().join(' ');
    out.push(`| \`${requirement}\` | ${ids} | ${suites} | ${tags} |`);
  }

  out.push('', '## Test case → requirement', '', '| Test case | Name | Requirements | Spec |', '| --- | --- | --- | --- |');
  for (const row of rows) {
    const requirements = row.requirements.map((r) => `\`${r}\``).join(', ') || '—';
    out.push(`| \`${row.id}\` | ${row.name} | ${requirements} | \`${row.file}\` |`);
  }

  if (untraced.length > 0) {
    out.push('', '## ⚠️ Test cases with no requirement', '');
    for (const row of untraced) out.push(`- \`${row.id}\` — ${row.name} (\`${row.file}\`)`);
  }

  out.push('');
  return out.join('\n');
}

function write(path, content, check) {
  const full = resolve(DOCS_DIR, path);
  if (check) {
    let existing = '';
    try {
      existing = readFileSync(full, 'utf8');
    } catch {
      existing = '';
    }
    if (existing !== content) {
      console.error(`✗ ${path} est périmé — lancer \`npm run trace -w e2e\` et commiter le résultat.`);
      return false;
    }
    console.log(`✓ ${path}`);
    return true;
  }

  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content, 'utf8');
  console.log(`✓ ${path}`);
  return true;
}

const check = process.argv.includes('--check');
const rows = listSpecs();

if (rows.length === 0) {
  console.error('Aucun test listé — la génération est probablement cassée.');
  process.exit(1);
}

const ok = [
  write('test-cases/test-cases.csv', buildCsv(rows), check),
  write('traceability-matrix.md', buildMatrix(rows), check),
].every(Boolean);

// A duplicated identifier makes the matrix lie: one row would claim to cover
// several distinct verifications, and deleting one of them would go unnoticed.
const duplicates = [...rows.reduce((acc, row) => acc.set(row.id, (acc.get(row.id) ?? 0) + 1), new Map())]
  .filter(([, count]) => count > 1)
  .map(([id]) => id);

if (duplicates.length > 0) {
  console.error(`✗ Identifiants de cas de test en double : ${duplicates.join(', ')}`);
  process.exit(1);
}

process.exit(ok ? 0 : 1);
