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
 * Compares the presented token with the order's, in constant time.
 *
 * The token is a UUID v4: guessing it end to end is out of reach, but `===`
 * exits at the first differing character, which turns it into an oracle that
 * can be walked back character by character. The countermeasure costs nothing;
 * accepting the risk did not.
 */
function matchesAccessToken(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
