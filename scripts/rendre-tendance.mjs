#!/usr/bin/env node
/**
 * Rend l'historique de tendance en une page HTML.
 *
 * Deux courbes et un tableau, en SVG inline : pas de bibliothèque de graphiques,
 * pas de JavaScript. La page doit s'ouvrir dans dix ans depuis un artifact
 * archivé, et une dépendance CDN morte n'affiche rien du tout.
 *
 *   node scripts/rendre-tendance.mjs <historique.jsonl> <sortie.html>
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const [historiqueArg, sortieArg] = process.argv.slice(2);
if (!historiqueArg || !sortieArg) {
  console.error('Usage : node scripts/rendre-tendance.mjs <historique.jsonl> <sortie.html>');
  process.exit(1);
}

const historique = resolve(historiqueArg);
const sortie = resolve(sortieArg);

/** Les runs les plus récents en dernier ; on n'en trace qu'une fenêtre. */
const FENETRE = 60;

const runs = existsSync(historique)
  ? readFileSync(historique, 'utf8')
      .split('\n')
      .filter((ligne) => ligne.trim() !== '')
      .map((ligne) => JSON.parse(ligne))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-FENETRE)
  : [];

function echapper(texte) {
  return String(texte).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

/**
 * Une courbe, dessinée sur une grille fixe.
 *
 * L'axe des ordonnées part de zéro et non du minimum observé : une échelle qui
 * s'ajuste aux données transforme une variation de 2 % en falaise, ce qui est
 * la façon la plus courante de mentir avec un graphique honnête.
 */
function courbe(valeurs, { hauteur = 140, largeur = 720, couleur, formater }) {
  if (valeurs.length === 0) return '<p class="vide">Aucune mesure.</p>';

  const max = Math.max(...valeurs, 0) || 1;
  const pas = valeurs.length > 1 ? largeur / (valeurs.length - 1) : 0;
  const y = (v) => hauteur - (v / max) * (hauteur - 12) - 6;

  const points = valeurs.map((v, i) => `${(i * pas).toFixed(1)},${y(v).toFixed(1)}`);
  const ligne = points.join(' ');
  const aire = `0,${hauteur} ${ligne} ${((valeurs.length - 1) * pas).toFixed(1)},${hauteur}`;

  const graduations = [0, 0.5, 1].map((part) => {
    const valeur = max * part;
    return `<line x1="0" y1="${y(valeur).toFixed(1)}" x2="${largeur}" y2="${y(valeur).toFixed(1)}" class="grille" />
      <text x="4" y="${(y(valeur) - 4).toFixed(1)}" class="graduation">${formater(valeur)}</text>`;
  });

  return `<svg viewBox="0 0 ${largeur} ${hauteur}" role="img" preserveAspectRatio="none">
    ${graduations.join('')}
    <polygon points="${aire}" fill="${couleur}" opacity="0.12" />
    <polyline points="${ligne}" fill="none" stroke="${couleur}" stroke-width="2" />
  </svg>`;
}

const dernier = runs.at(-1);
const secondes = (ms) => Math.round(ms / 1000);

const lignesTableau = [...runs]
  .reverse()
  .slice(0, 20)
  .map((run) => {
    const icone = run.statut === 'passed' ? '✅' : run.statut === 'failed' ? '❌' : '⚠️';
    return `<tr>
      <td>${echapper(run.date.slice(0, 16).replace('T', ' '))}</td>
      <td><code>${echapper(run.commit ?? '—')}</code></td>
      <td>${icone}</td>
      <td class="nombre">${run.reussis}/${run.total}</td>
      <td class="nombre">${run.echoues}</td>
      <td class="nombre">${run.instables}</td>
      <td class="nombre">${(run.tauxInstables * 100).toFixed(2)} %</td>
      <td class="nombre">${secondes(run.dureeMs)} s</td>
    </tr>`;
  })
  .join('\n');

const STYLE = `
:root { --fond:#fff; --texte:#1a1d21; --attenue:#5c6570; --trait:#e2e6ea; --accent:#1c5d99; --alerte:#b8541a; --code:#f4f6f8; }
@media (prefers-color-scheme: dark) {
  :root { --fond:#14171a; --texte:#e6e9ec; --attenue:#9aa4ae; --trait:#2a2f35; --accent:#7ab3e0; --alerte:#e0975a; --code:#1c2024; }
}
* { box-sizing: border-box; }
body { margin:0; padding:2.5rem 1.25rem 5rem; background:var(--fond); color:var(--texte);
  font:16px/1.6 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
main { max-width:52rem; margin:0 auto; }
nav { max-width:52rem; margin:0 auto 2rem; font-size:.875rem; color:var(--attenue); }
nav a { color:var(--attenue); }
h1 { font-size:1.9rem; margin:0 0 .35rem; }
h2 { font-size:1.2rem; margin:2.5rem 0 .5rem; }
p.chapeau { color:var(--attenue); margin:0 0 2rem; }
.cartes { display:flex; flex-wrap:wrap; gap:1rem; margin:1.5rem 0; }
.carte { flex:1 1 9rem; border:1px solid var(--trait); border-radius:8px; padding:.85rem 1rem; }
.carte .valeur { font-size:1.5rem; font-weight:600; }
.carte .libelle { font-size:.8rem; color:var(--attenue); }
svg { width:100%; height:140px; display:block; border:1px solid var(--trait); border-radius:8px; background:var(--code); }
.grille { stroke:var(--trait); stroke-width:1; }
.graduation { fill:var(--attenue); font-size:10px; }
.tableau { overflow-x:auto; margin-top:1rem; }
table { border-collapse:collapse; width:100%; font-size:.875rem; }
th, td { border:1px solid var(--trait); padding:.4rem .6rem; text-align:left; }
th { background:var(--code); }
td.nombre { text-align:right; font-variant-numeric:tabular-nums; }
code { background:var(--code); padding:.1em .3em; border-radius:3px; font-size:.85em; }
.vide { color:var(--attenue); font-style:italic; }
footer { max-width:52rem; margin:3rem auto 0; padding-top:1.25rem; border-top:1px solid var(--trait);
  font-size:.8rem; color:var(--attenue); }
`;

const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Tendance — Fretline QA</title>
<style>${STYLE}</style>
</head>
<body>
<nav><a href="index.html">Rapport de tests</a> · <a href="docs/index.html">Documentation QA</a></nav>
<main>
<h1>Tendance</h1>
<p class="chapeau">${runs.length} run${runs.length > 1 ? 's' : ''} nocturne${runs.length > 1 ? 's' : ''} enregistré${runs.length > 1 ? 's' : ''}${dernier ? ` — dernier le ${echapper(dernier.date.slice(0, 10))}` : ''}. Un rapport par run dit ce qui a cassé ; celui-ci dit depuis quand.</p>

${
  dernier
    ? `<div class="cartes">
  <div class="carte"><div class="valeur">${dernier.reussis}/${dernier.total}</div><div class="libelle">réussis au dernier run</div></div>
  <div class="carte"><div class="valeur">${secondes(dernier.dureeMs)} s</div><div class="libelle">durée cumulée</div></div>
  <div class="carte"><div class="valeur">${(dernier.tauxInstables * 100).toFixed(2)} %</div><div class="libelle">taux d’instabilité</div></div>
  <div class="carte"><div class="valeur">${dernier.instables}</div><div class="libelle">tests instables</div></div>
</div>`
    : '<p class="vide">Aucun run enregistré pour l’instant. Le premier nightly alimentera cette page.</p>'
}

<h2>Durée cumulée de la suite</h2>
${courbe(runs.map((r) => secondes(r.dureeMs)), { couleur: 'var(--accent)', formater: (v) => `${Math.round(v)} s` })}

<h2>Taux d’instabilité</h2>
${courbe(runs.map((r) => r.tauxInstables * 100), { couleur: 'var(--alerte)', formater: (v) => `${v.toFixed(1)} %` })}

<h2>Vingt derniers runs</h2>
<div class="tableau">
<table>
<thead><tr><th>Date</th><th>Commit</th><th></th><th>Réussis</th><th>Échecs</th><th>Instables</th><th>Taux</th><th>Durée</th></tr></thead>
<tbody>
${lignesTableau || '<tr><td colspan="8" class="vide">Rien à afficher.</td></tr>'}
</tbody>
</table>
</div>
</main>
<footer>Généré depuis l’historique de la branche <code>historique-qa</code>. Échelles à partir de zéro : une échelle ajustée aux données transforme 2 % de variation en falaise.</footer>
</body>
</html>
`;

mkdirSync(dirname(sortie), { recursive: true });
writeFileSync(sortie, html);
console.log(`Page de tendance écrite (${runs.length} run(s)) → ${sortie}`);
