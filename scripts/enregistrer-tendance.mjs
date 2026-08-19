#!/usr/bin/env node
/**
 * Ajoute un run à l'historique de tendance.
 *
 * Chaque run produit son instantané : combien de tests, combien d'échecs,
 * combien d'instables, combien de temps. Aucun ne dit si la suite ralentit
 * depuis trois semaines, ni si un test devient instable une fois sur dix — ce
 * qui est pourtant la seule façon de voir venir la dérive plutôt que de la
 * subir. Il y faut une mémoire, et un rapport par run n'en a pas.
 *
 * Le format est du JSON Lines : une ligne par run, ajoutée à la fin. Deux runs
 * qui écrivent en même temps produisent au pire deux lignes dans le désordre,
 * jamais un fichier illisible — ce qu'un JSON réécrit à chaque fois ne garantit
 * pas.
 *
 *   node scripts/enregistrer-tendance.mjs <resume.json> <historique.jsonl>
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const [resumeArg, historiqueArg] = process.argv.slice(2);
if (!resumeArg || !historiqueArg) {
  console.error('Usage : node scripts/enregistrer-tendance.mjs <resume.json> <historique.jsonl>');
  process.exit(1);
}

const resume = resolve(resumeArg);
const historique = resolve(historiqueArg);

if (!existsSync(resume)) {
  console.error(`Résumé introuvable : ${resume}. Le run n'a rien produit à enregistrer.`);
  process.exit(1);
}

const { statut, total, totaux, projets, instables } = JSON.parse(readFileSync(resume, 'utf8'));

// Le taux d'instabilité se rapporte aux tests exécutés, pas au total : compter
// les ignorés au dénominateur ferait baisser le taux en désactivant des tests.
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
  `Run enregistré : ${ligne.reussis}/${ligne.total} réussis · ${ligne.instables} instables ` +
    `(${(tauxInstables * 100).toFixed(2)} %) · ${Math.round(ligne.dureeMs / 1000)} s cumulés`,
);
