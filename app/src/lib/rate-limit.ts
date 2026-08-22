/**
 * Limitation de débit par fenêtre fixe.
 *
 * L'enveloppe d'erreur déclarait `RATE_LIMITED` et son 429 depuis le premier
 * jour, mais rien ne l'émettait : le code existait, le mécanisme non. Un audit
 * l'a relevé sur `POST /api/auth/login`, qui exécute un scrypt — délibérément
 * lent, 50 à 100 ms — avant de répondre. Sans limite, la même route sert donc
 * à la fois au bruteforce et au déni de service : le test de rupture situe le
 * mur de la production entre 80 et 90 parcours par seconde, CPU-lié, et
 * quelques dizaines de requêtes par seconde sur `login` suffisent à l'atteindre.
 *
 * Compteur en mémoire, et pas Redis. Le déploiement est un conteneur unique
 * (docker-compose.yml) : une dépendance de plus coûterait un service, un
 * volume et un mode de panne supplémentaires pour un état que ce processus
 * détient déjà. La limite est **par processus** — au jour où l'application
 * passe à deux répliques, le plafond effectif double, et c'est le moment de
 * déplacer ce compteur, pas avant.
 *
 * Épinglé sur `globalThis` pour la même raison que le pool PostgreSQL
 * (db/client.ts) : Next recharge les modules en développement, et un compteur
 * neuf à chaque rechargement remettrait la limite à zéro à chaque sauvegarde.
 */

import { isTestMode } from '@/lib/deployment';

export interface RateLimitRule {
  /** Nombre de requêtes autorisées par fenêtre. */
  limit: number;
  /** Durée de la fenêtre, en secondes. */
  windowSeconds: number;
}

/**
 * Les règles sont serrées là où l'appel coûte cher au serveur ou ouvre sur un
 * secret, et larges ailleurs. Un visiteur légitime ne les atteint pas : six
 * tentatives de connexion par minute couvre largement la faute de frappe.
 */
export const RATE_LIMITS = {
  login: { limit: 6, windowSeconds: 60 },
  register: { limit: 4, windowSeconds: 600 },
  order: { limit: 10, windowSeconds: 600 },
  review: { limit: 5, windowSeconds: 600 },
  coupon: { limit: 20, windowSeconds: 60 },
} as const satisfies Record<string, RateLimitRule>;

export type RateLimitName = keyof typeof RATE_LIMITS;

/**
 * Facteur appliqué aux plafonds sous `E2E_TEST_MODE=1`.
 *
 * La suite s'exécute sans proxy devant elle, donc sans `x-forwarded-for` : tous
 * ses appels partagent un seul et même seau. Quatre inscriptions par dix
 * minutes, plafond juste en production, arrête la suite au quinzième test — ce
 * qui a effectivement eu lieu.
 *
 * Un facteur plutôt qu'un court-circuit : le chemin de code reste emprunté à
 * chaque requête, en-têtes compris, donc une régression qui casserait le
 * limiteur se verrait toujours. Ce qui change est la borne, pas la mécanique.
 * L'algorithme lui-même est éprouvé par les tests unitaires — `consume()` prend
 * son horloge en paramètre exactement pour ça — plutôt que par la suite d'API,
 * où il faudrait fabriquer un millier de requêtes pour voir un 429.
 *
 * Ne jamais l'appliquer hors mode test : le discriminant est le même que
 * partout ailleurs dans ce dépôt (lib/deployment.ts), et il est fail-closed.
 */
const FACTEUR_MODE_TEST = 250;

function effectiveLimit(rule: RateLimitRule): number {
  return isTestMode() ? rule.limit * FACTEUR_MODE_TEST : rule.limit;
}

interface Window {
  count: number;
  /** Horodatage de fin de fenêtre, en millisecondes. */
  resetAt: number;
}

const STORE = Symbol.for('fretline.rateLimit');

interface GlobalWithStore {
  [STORE]?: Map<string, Window>;
}

function store(): Map<string, Window> {
  const holder = globalThis as GlobalWithStore;
  holder[STORE] ??= new Map();
  return holder[STORE];
}

/**
 * Purge les fenêtres expirées.
 *
 * Sans elle la Map croît d'une entrée par adresse IP vue et ne rend jamais
 * rien : un balayage suffisamment long finirait par la faire tenir toute la
 * mémoire du conteneur. Le balayage est amorti sur les écritures plutôt que
 * confié à un `setInterval`, qui tiendrait le processus éveillé pour rien.
 */
function purgeExpired(now: number): void {
  for (const [key, window] of store()) {
    if (window.resetAt <= now) store().delete(key);
  }
}

let writesSincePurge = 0;
const PURGE_EVERY = 500;

/**
 * Identifie l'appelant.
 *
 * `x-forwarded-for` n'est digne de confiance que parce que Caddy est le seul
 * point d'entrée (docker-compose.yml : l'application n'expose aucun port sur
 * l'hôte) et qu'il réécrit l'en-tête. Exposer `app` directement rendrait cette
 * valeur forgeable, et la limite contournable d'un en-tête.
 *
 * La première adresse de la liste est le client ; les suivantes sont les
 * proxys traversés.
 */
export function callerKey(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const first = forwarded?.split(',')[0]?.trim();
  return first || request.headers.get('x-real-ip')?.trim() || 'inconnu';
}

export interface RateLimitResult {
  allowed: boolean;
  /** Requêtes encore autorisées dans la fenêtre courante. */
  remaining: number;
  /** Secondes à attendre avant que la fenêtre ne se rouvre. */
  retryAfterSeconds: number;
  limit: number;
}

/**
 * Consomme une unité du quota et dit si l'appel peut passer.
 *
 * Le compteur est incrémenté même lorsque la réponse sera un refus : c'est ce
 * qui empêche de maintenir un débit constant juste sous le plafond en ignorant
 * les 429.
 */
export function consume(
  name: RateLimitName,
  request: Request,
  now: number = Date.now(),
): RateLimitResult {
  const rule = RATE_LIMITS[name];
  const limit = effectiveLimit(rule);
  const key = `${name}:${callerKey(request)}`;
  const windowMs = rule.windowSeconds * 1000;

  if (++writesSincePurge >= PURGE_EVERY) {
    writesSincePurge = 0;
    purgeExpired(now);
  }

  let window = store().get(key);
  if (!window || window.resetAt <= now) {
    window = { count: 0, resetAt: now + windowMs };
    store().set(key, window);
  }

  window.count += 1;

  const allowed = window.count <= limit;
  return {
    allowed,
    remaining: Math.max(0, limit - window.count),
    retryAfterSeconds: Math.max(1, Math.ceil((window.resetAt - now) / 1000)),
    limit,
  };
}

/** Vide le compteur. Réservé aux tests unitaires. */
export function resetRateLimits(): void {
  store().clear();
  writesSincePurge = 0;
}
