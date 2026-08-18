# syntax=docker/dockerfile:1

# Image de production de l'application.
#
# Trois étages : installation des dépendances, build, puis une image d'exécution
# qui ne contient ni source, ni chaîne d'outils, ni dépendance de développement.
#
# Le point délicat vient des workspaces npm. Le `package-lock.json` est à la
# racine, et la sortie `standalone` de Next reproduit l'arborescence du monorepo :
# le point d'entrée est `app/server.js`, les dépendances sont un cran au-dessus.
# D'où la mise en place à `/srv` plutôt qu'à `/srv/app`.

ARG NODE_VERSION=20-alpine

# --- Dépendances ------------------------------------------------------------
FROM node:${NODE_VERSION} AS deps
WORKDIR /build

# Les manifestes des deux workspaces sont nécessaires : npm réconcilie le
# lockfile avec l'ensemble des workspaces déclarés, même quand on n'en installe
# qu'un. `--workspace app` évite en revanche de télécharger Playwright et ses
# navigateurs, qui n'ont rien à faire ici.
COPY package.json package-lock.json ./
COPY app/package.json app/package.json
COPY e2e/package.json e2e/package.json
RUN npm ci --workspace app --include-workspace-root

# --- Build ------------------------------------------------------------------
FROM node:${NODE_VERSION} AS builder
WORKDIR /build

COPY --from=deps /build/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY e2e/package.json e2e/package.json
COPY app ./app

# `BUILD_STANDALONE=1` est ce qui déclenche la sortie autonome — voir
# next.config.ts : elle n'a de sens que pour cette image, et un build qui la
# porte ne peut plus être servi par `next start`, dont dépendent la suite et la
# CI.
#
# Aucune base n'est nécessaire : toutes les routes sont dynamiques (`ƒ` dans la
# sortie de `next build`), et `db/client.ts` n'ouvre son pool qu'à la première
# requête. Si une page devenait prérendue, le build échouerait ici — c'est voulu.
ENV BUILD_STANDALONE=1
RUN npm run build -w app \
 && node app/scripts/build-db-cli.mjs

# --- Exécution --------------------------------------------------------------
FROM node:${NODE_VERSION} AS runner
WORKDIR /srv

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1

# `standalone/` contient `app/server.js` et les modules réellement tracés ; le
# reste de node_modules ne suit pas.
COPY --from=builder --chown=node:node /build/app/.next/standalone ./
COPY --from=builder --chown=node:node /build/app/.next/static ./app/.next/static

# Les commandes de base (bootstrap, migrate, seed, purge), compilées en ESM
# autonome, et les migrations SQL qu'elles appliquent. `dist/db/migrate.mjs`
# cherche ses migrations à `../../drizzle` : l'emplacement ci-dessous n'est pas
# décoratif.
COPY --from=builder --chown=node:node /build/app/dist ./app/dist
COPY --from=builder --chown=node:node /build/app/drizzle ./app/drizzle

USER node
EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD wget --quiet --spider http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "app/server.js"]
