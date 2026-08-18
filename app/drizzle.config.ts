import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgresql://fretline:fretline@localhost:5432/fretline',
  },
  casing: 'snake_case',
  strict: true,
  verbose: true,
});
