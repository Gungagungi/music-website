#!/usr/bin/env node
/**
 * Renders `docs/` as HTML for publication on GitHub Pages.
 *
 * The workflow used to copy the raw `.md` files next to the Playwright report.
 * A browser downloads them or shows them as plain text depending on the guessed
 * MIME type: a 139-row traceability table becomes unreadable there, and it is
 * precisely the document an outside reader comes to see. On GitHub they read
 * fine — but then publishing adds nothing a link to the repository would not
 * give better.
 *
 * Rendering deliberately has no layout dependency: `marked` for the Markdown,
 * an inline stylesheet, no JavaScript. A documentation page that needs a
 * runtime to display is a page that will stop displaying.
 *
 *   node scripts/rendre-docs.mjs <destination>
 */
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';

import { marked } from 'marked';

const RACINE = resolve(import.meta.dirname, '..');
const SOURCE = resolve(RACINE, 'docs');
const DESTINATION = resolve(process.argv[2] ?? 'site/docs');

/** Every leaf under `docs/`, as paths relative to `docs/`. */
function fichiers(racine = SOURCE, repertoire = racine) {
  return readdirSync(repertoire, { withFileTypes: true }).flatMap((entree) => {
    const chemin = join(repertoire, entree.name);
    return entree.isDirectory() ? fichiers(racine, chemin) : [relative(racine, chemin)];
  });
}

/**
 * Rewrites internal links to their rendered equivalent.
 *
 * `test-strategy.md` → `test-strategy.html`, and `adr/` → `adr/index.html`: a
 * link to a directory relies on GitHub's resolution, which Pages does not
 * reproduce. External links, anchors and non-rendered files (the CSV) pass
 * through unchanged.
 */
function reecrireLien(href) {
  if (/^([a-z]+:|#|\/\/)/i.test(href)) return href;
  const [chemin, ancre] = href.split('#');
  const suffixe = ancre ? `#${ancre}` : '';
  if (chemin.endsWith('.md')) return `${chemin.slice(0, -3)}.html${suffixe}`;
  if (chemin.endsWith('/')) return `${chemin}index.html${suffixe}`;
  return href;
}

const STYLE = `
:root {
  --fond: #ffffff; --texte: #1a1d21; --attenue: #5c6570; --trait: #e2e6ea;
  --accent: #1c5d99; --code-fond: #f4f6f8;
}
@media (prefers-color-scheme: dark) {
  :root {
    --fond: #14171a; --texte: #e6e9ec; --attenue: #9aa4ae; --trait: #2a2f35;
    --accent: #7ab3e0; --code-fond: #1c2024;
  }
}
* { box-sizing: border-box; }
body {
  margin: 0; padding: 2.5rem 1.25rem 5rem; background: var(--fond); color: var(--texte);
  font: 16px/1.65 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
}
main { max-width: 46rem; margin: 0 auto; }
nav.fil { max-width: 46rem; margin: 0 auto 2rem; font-size: .875rem; color: var(--attenue); }
nav.fil a { color: var(--attenue); }
h1, h2, h3, h4 { line-height: 1.25; margin: 2.25rem 0 .75rem; }
h1 { font-size: 1.9rem; margin-top: 0; }
h2 { font-size: 1.4rem; padding-bottom: .3rem; border-bottom: 1px solid var(--trait); }
h3 { font-size: 1.15rem; }
a { color: var(--accent); }
code { background: var(--code-fond); padding: .15em .35em; border-radius: 3px; font-size: .875em; }
pre { background: var(--code-fond); padding: 1rem; border-radius: 6px; overflow-x: auto; }
pre code { background: none; padding: 0; }
blockquote {
  margin: 1.25rem 0; padding: .35rem 0 .35rem 1rem;
  border-left: 3px solid var(--trait); color: var(--attenue);
}
/* Traceability tables are wide: they scroll inside their frame rather than
   forcing horizontal scrolling on the whole page. */
.tableau { overflow-x: auto; margin: 1.25rem 0; }
table { border-collapse: collapse; width: 100%; font-size: .9rem; }
th, td { border: 1px solid var(--trait); padding: .45rem .7rem; text-align: left; vertical-align: top; }
th { background: var(--code-fond); }
img { max-width: 100%; }
hr { border: none; border-top: 1px solid var(--trait); margin: 2.5rem 0; }
footer { max-width: 46rem; margin: 3rem auto 0; padding-top: 1.25rem;
  border-top: 1px solid var(--trait); font-size: .8rem; color: var(--attenue); }
`;

function page(titre, corps, profondeur) {
  const racine = profondeur === 0 ? '.' : Array(profondeur).fill('..').join('/');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${titre} — Fretline QA</title>
<style>${STYLE}</style>
</head>
<body>
<nav class="fil"><a href="${racine}/index.html">QA documentation</a> · <a href="${racine}/../index.html">Test report</a></nav>
<main>
${corps}
</main>
<footer>Fretline — documentation generated from <code>docs/</code>. The repository is the source of truth.</footer>
</body>
</html>
`;
}

/** The title is the document's first `# `; failing that, its file name. */
function titreDe(markdown, secours) {
  const ligne = markdown.split('\n').find((l) => l.startsWith('# '));
  return ligne ? ligne.slice(2).trim() : secours;
}

mkdirSync(DESTINATION, { recursive: true });

let rendus = 0;
let copies = 0;

for (const relatif of fichiers()) {
  const source = join(SOURCE, relatif);
  const profondeur = relatif.split('/').length - 1;

  if (extname(relatif) !== '.md') {
    const cible = join(DESTINATION, relatif);
    mkdirSync(dirname(cible), { recursive: true });
    cpSync(source, cible);
    copies += 1;
    continue;
  }

  const markdown = readFileSync(source, 'utf8');
  const moteur = new marked.Renderer();
  const lienOrigine = moteur.link.bind(moteur);
  moteur.link = (jeton) => lienOrigine({ ...jeton, href: reecrireLien(jeton.href) });
  const tableOrigine = moteur.table.bind(moteur);
  moteur.table = (jeton) => `<div class="tableau">${tableOrigine(jeton)}</div>`;

  const corps = marked.parse(markdown, { renderer: moteur, async: false });
  // `README.md` becomes `index.html`: that is what a link to a directory serves,
  // and what Pages opens by default.
  const nom = relatif.replace(/README\.md$/, 'index.md').replace(/\.md$/, '.html');
  const cible = join(DESTINATION, nom);
  mkdirSync(dirname(cible), { recursive: true });
  writeFileSync(cible, page(titreDe(markdown, nom), corps, profondeur));
  rendus += 1;
}

/**
 * A dead link in published documentation is worse than a missing one: it
 * promises a page. The `.md` → `.html` rewrite easily produces them — a renamed
 * document, a moved directory — and nothing would say so before a reader
 * stumbled on one. The check therefore runs on every render, and fails the
 * build rather than publishing.
 *
 * Links that leave `docs/` are out of scope: `../index.html` refers to the
 * Playwright report, assembled by the workflow after this step.
 */
const morts = [];
for (const produit of fichiers(DESTINATION)) {
  if (extname(produit) !== '.html') continue;
  const html = readFileSync(join(DESTINATION, produit), 'utf8');
  for (const [, href] of html.matchAll(/href="([^"]+)"/g)) {
    if (/^([a-z]+:|#|\/\/)/i.test(href)) continue;
    const cible = href.split('#')[0];
    if (!cible) continue;
    const resolu = resolve(dirname(join(DESTINATION, produit)), cible);
    if (!resolu.startsWith(DESTINATION)) continue;
    if (!existsSync(resolu)) morts.push(`${produit} → ${href}`);
  }
}

if (morts.length > 0) {
  console.error(`${morts.length} dead internal link(s):`);
  for (const mort of morts) console.error(`  ${mort}`);
  process.exit(1);
}

console.log(`${rendus} documents rendered, ${copies} files copied as-is → ${DESTINATION}`);
