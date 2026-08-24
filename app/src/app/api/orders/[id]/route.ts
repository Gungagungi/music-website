import { timingSafeEqual } from 'node:crypto';

import { fail, ok } from '@/lib/api';
import { currentUserFromRequest } from '@/lib/auth';
import { findOrderByIdOrReference } from '@/lib/repositories/orders';

export const dynamic = 'force-dynamic';

/**
 * An order is readable by its owner, or by anyone presenting the one-time
 * access token handed back at creation (guest checkout). Everything else is a
 * 403 — and deliberately not a 404, because the resource does exist.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await findOrderByIdOrReference(id);
  if (!order) return fail('NOT_FOUND', 'Commande introuvable.');

  const providedToken = request.headers.get('x-order-token');
  if (providedToken && matchesAccessToken(providedToken, order.accessToken)) {
    return ok(order);
  }

  const user = await currentUserFromRequest(request);
  if (!user) return fail('UNAUTHORIZED', 'Authentification requise.');
  if (order.userId !== user.id) {
    return fail('FORBIDDEN', 'Vous n’avez pas accès à cette commande.');
  }

  return ok(order);
}

/**
 * Compare le jeton présenté à celui de la commande, à temps constant.
 *
 * Le jeton est un UUID v4 : le deviner de bout en bout est hors de portée, mais
 * `===` sort au premier caractère différent, ce qui en fait un oracle qui se
 * remonte caractère par caractère. Le coût de la parade est nul, l'assumer ne
 * l'était pas.
 */
function matchesAccessToken(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
