import { fail, ok } from '@/lib/api';
import { currentUserFromRequest } from '@/lib/auth';
import { wishlistFor } from '@/lib/repositories/wishlist';

export const dynamic = 'force-dynamic';

/** The signed-in customer's saved products — never anybody else's. */
export async function GET(request: Request) {
  const user = await currentUserFromRequest(request);
  if (!user) return fail('UNAUTHORIZED', 'Connectez-vous pour consulter vos favoris.');

  return ok({ items: await wishlistFor(user.id) });
}
