import { eq, sql } from 'drizzle-orm';

import { db } from '@/db/client';
import type { DbOrTx } from '@/db/client';
import { toUser } from '@/db/mappers';
import { users } from '@/db/schema';
import { hashPassword } from '@/lib/password';
import type { User } from '@/lib/types';

/**
 * Everything that reads or writes `users`.
 *
 * Email lookups go through `lower(email)` so they hit `users_email_lower_key` —
 * the same index that enforces case-insensitive uniqueness. Comparing on the raw
 * column would work but silently fall back to a sequential scan, and would
 * disagree with the constraint on `Claire@…` vs `claire@…`.
 */

export async function findUserById(id: string, executor: DbOrTx = db): Promise<User | undefined> {
  const [row] = await executor.select().from(users).where(eq(users.id, id)).limit(1);
  return row ? toUser(row) : undefined;
}

export async function findUserByEmail(
  email: string,
  executor: DbOrTx = db,
): Promise<User | undefined> {
  const [row] = await executor
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = lower(${email})`)
    .limit(1);
  return row ? toUser(row) : undefined;
}

export interface NewUser {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

/**
 * Creates an account, or returns `undefined` when the address is already taken.
 *
 * Two layers, on purpose. The lookup handles the ordinary case — someone
 * re-registering an address they already own — without touching the sequence:
 * `nextval` is not transactional, so an INSERT that loses to `ON CONFLICT` still
 * consumes an identifier, and going straight to the INSERT would leave a gap in
 * the `USR-xxxx` series on every duplicate.
 *
 * `ON CONFLICT DO NOTHING` then covers what the lookup cannot: two concurrent
 * registrations that both see a free address. `users_email_lower_key` arbitrates,
 * and the loser gets the same "already taken" answer instead of a 500.
 */
export async function createUser(input: NewUser, executor: DbOrTx = db): Promise<User | undefined> {
  if (await findUserByEmail(input.email, executor)) return undefined;

  const [row] = await executor
    .insert(users)
    .values({
      id: sql`'USR-' || lpad(nextval('user_id_seq')::text, 4, '0')`,
      email: input.email.toLowerCase(),
      firstName: input.firstName,
      lastName: input.lastName,
      passwordHash: hashPassword(input.password),
      createdAt: new Date(),
    })
    .onConflictDoNothing()
    .returning();

  return row ? toUser(row) : undefined;
}

export async function countUsers(executor: DbOrTx = db): Promise<number> {
  const [row] = await executor.select({ count: sql<number>`count(*)::int` }).from(users);
  return row?.count ?? 0;
}
