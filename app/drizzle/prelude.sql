-- Prelude — executed by src/db/migrate.ts before the generated migrations.
--
-- It lives in its own file rather than at the top of 0000_*.sql because
-- drizzle-kit rewrites generated migrations wholesale: a hand-edit at the top of
-- one is lost the next time anybody regenerates it, and the loss is silent until
-- a fresh database refuses to build.
--
-- Every statement here must be idempotent — this runs on every startup.

CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Stock `unaccent(text)` is only STABLE — its dictionary can be reloaded at
-- runtime — and PostgreSQL refuses a non-IMMUTABLE function in a generated column
-- or an index. The two-argument form takes the dictionary explicitly, so pinning
-- it makes the result reproducible and this wrapper honestly immutable.
--
-- It mirrors `normalise()` in lib/catalog.ts: strip accents, fold case.
CREATE OR REPLACE FUNCTION fretline_unaccent(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
PARALLEL SAFE
AS $$
  SELECT public.unaccent('public.unaccent'::regdictionary, input)
$$;
