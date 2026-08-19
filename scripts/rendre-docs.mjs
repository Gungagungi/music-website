#!/usr/bin/env node
/**
 * Rend `docs/` en HTML pour la publication sur GitHub Pages.
 *
 * Le workflow copiait jusqu'ici les `.md` bruts à côté du rapport Playwright.
 * Un navigateur les télécharge ou les affiche en texte brut selon le type MIME
 * deviné : un tableau de traçabilité de 139 lignes y devient illisible, et c'est
 * précisément le document qu'un lecteur extérieur vient voir. Sur GitHub ils se
 * lisent bien — mais alors la publication n'apporte rien qu'un lien vers le
 * dépôt ne donnerait mieux.
 *
 * Le rendu est délibérément sans dépendance de mise en page : `marked` pour le
 * Markdown, une feuille de style inline, aucun JavaScript. Une page de
 * documentation qui exige un runtime pour s'afficher est une page qui cessera
 * de s'afficher.
 *
 *   node scripts/rendre-docs.mjs <destination>
 */
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';

import { marked } from 'marked';

const RACINE = resolve(import.meta.dirname, '..');
const SOURCE = resolve(RACINE, 'docs');
const DESTINATION = resolve(process.argv[2] ?? 'site/docs');

/** Toutes les feuilles de `docs/`, chemins relatifs à `docs/`. */
function fichiers(racine = SOURCE, repertoire = racine) {
  return readdirSync(repertoire, { withFileTypes: true }).flatMap((entree) => {
    const chemin = join(repertoire, entree.name);
    return entree.isDirectory() ? fichiers(racine, chemin) : [relative(racine, chemin)];
  });
}

/**
 * Réécrit les liens internes vers leur équivalent rendu.
 *
 * `test-strategy.md` → `test-strategy.html`, et `adr/` → `adr/index.html` : un
 * lien vers un répertoire s'appuie sur la résolution de GitHub, que Pages ne
 * reproduit pas. Les liens externes, les ancres et les fichiers non rendus
 * (le CSV) passent inchangés.
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
/* Les tableaux de traçabilité sont larges : ils défilent dans leur cadre plutôt
   que d'imposer un défilement horizontal à la page entière. */
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
<footer>Fretline — documentation générée depuis <code>docs/</code>. Le dépôt fait foi.</footer>
</body>
</html>
`;
}

/** Le titre est le premier `# ` du document ; à défaut, son nom de fichier. */
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
  // `README.md` devient `index.html` : c'est ce qu'un lien vers un répertoire
  // sert, et ce que Pages ouvre par défaut.
  const nom = relatif.replace(/README\.md$/, 'index.md').replace(/\.md$/, '.html');
  const cible = join(DESTINATION, nom);
  mkdirSync(dirname(cible), { recursive: true });
  writeFileSync(cible, page(titreDe(markdown, nom), corps, profondeur));
  rendus += 1;
}

/**
 * Un lien mort dans une documentation publiée est pire qu'un lien absent : il
 * promet une page. La réécriture `.md` → `.html` en fabrique facilement — un
 * document renommé, un répertoire déplacé — et rien ne le dirait avant qu'un
 * lecteur ne tombe dessus. La vérification tourne donc à chaque rendu, et
 * échoue le build plutôt que de publier.
 *
 * Les liens qui sortent de `docs/` sont hors périmètre : `../index.html` désigne
 * le rapport Playwright, assemblé par le workflow après cette étape.
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
  console.error(`${morts.length} lien(s) interne(s) mort(s) :`);
  for (const mort of morts) console.error(`  ${mort}`);
  process.exit(1);
}

console.log(`${rendus} documents rendus, ${copies} fichiers copiés tels quels → ${DESTINATION}`);
