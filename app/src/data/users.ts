/**
 * Seeded accounts. Passwords are stored in clear text *in the seed only* — they
 * are hashed with scrypt when the database is (re)built. The test suite needs
 * to know these credentials, so keeping them in one obvious place beats hiding
 * them behind an env var nobody can find.
 */
export interface SeedUser {
  id: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  createdAt: string;
}

export const SEED_USERS: SeedUser[] = [
  {
    id: 'USR-0001',
    email: 'claire.dubois@fretline.test',
    password: 'Guitare2026!',
    firstName: 'Claire',
    lastName: 'Dubois',
    createdAt: '2025-03-14T09:12:00.000Z',
  },
  {
    id: 'USR-0002',
    email: 'marc.lefevre@fretline.test',
    password: 'BasseLine77!',
    firstName: 'Marc',
    lastName: 'Lefèvre',
    createdAt: '2025-06-02T14:45:00.000Z',
  },
  {
    id: 'USR-0003',
    email: 'sans.commande@fretline.test',
    password: 'PanierVide12!',
    firstName: 'Nadia',
    lastName: 'Roux',
    createdAt: '2026-01-08T08:00:00.000Z',
  },
];
