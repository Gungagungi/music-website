import { cookies } from 'next/headers';

import { ok } from '@/lib/api';
import { AUTH_COOKIE } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST() {
  (await cookies()).delete(AUTH_COOKIE);
  return ok({ loggedOut: true });
}
