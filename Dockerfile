# syntax=docker/dockerfile:1

# Production image of the application.
#
# Three stages: dependency installation, build, then a runtime image that
# contains no source, no toolchain and no development dependency.
#
# The tricky part comes from npm workspaces. `package-lock.json` sits at the
# root, and Next's `standalone` output reproduces the monorepo tree: the entry
# point is `app/server.js`, the dependencies are one level up. Hence the layout
# at `/srv` rather than `/srv/app`.

ARG NODE_VERSION=22-alpine

# --- Dependencies -----------------------------------------------------------
FROM node:${NODE_VERSION} AS deps
WORKDIR /build

# Both workspaces' manifests are needed: npm reconciles the lockfile with every
# declared workspace, even when only one is installed. `--workspace app`, on
# the other hand, avoids downloading Playwright and its browsers, which have no
# business here.
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

# `BUILD_STANDALONE=1` is what triggers the standalone output — see
# next.config.ts: it only makes sense for this image, and a build that carries
# it can no longer be served by `next start`, which the suite and CI depend on.
#
# No database is needed: every route is dynamic (`ƒ` in the `next build`
# output), and `db/client.ts` only opens its pool on the first request. If a
# page became prerendered, the build would fail here — that is intended.
ENV BUILD_STANDALONE=1

# Matomo instance address and site ID. `NEXT_PUBLIC_*` is substituted at
# compile time, not read at run time: these two values must therefore come in
# here, as build arguments, and changing either one requires rebuilding the
# image. Empty by default — the tracker then renders nothing.
ARG NEXT_PUBLIC_MATOMO_URL=""
ARG NEXT_PUBLIC_MATOMO_SITE_ID=""
ENV NEXT_PUBLIC_MATOMO_URL=$NEXT_PUBLIC_MATOMO_URL \
    NEXT_PUBLIC_MATOMO_SITE_ID=$NEXT_PUBLIC_MATOMO_SITE_ID

RUN npm run build -w app \
 && node app/scripts/build-db-cli.mjs

# --- Runtime ----------------------------------------------------------------
FROM node:${NODE_VERSION} AS runner
WORKDIR /srv

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1

# `standalone/` contains `app/server.js` and the modules actually traced; the
# rest of node_modules does not come along.
COPY --from=builder --chown=node:node /build/app/.next/standalone ./
COPY --from=builder --chown=node:node /build/app/.next/static ./app/.next/static

# The database commands (bootstrap, migrate, seed, purge), compiled to
# standalone ESM, and the SQL migrations they apply. `dist/db/migrate.mjs`
# looks for its migrations at `../../drizzle`: the location below is not
# decorative.
COPY --from=builder --chown=node:node /build/app/dist ./app/dist
COPY --from=builder --chown=node:node /build/app/drizzle ./app/drizzle

# npm and yarn ship with the base image, and no entry point of the stack calls
# them: the server, the bootstrap and the purge are all started by `node` on
# already bundled code. They are therefore nothing but attack surface, and not
# in theory — the Trivy scan of the image reported 9 CVEs (1 critical, 8 high),
# all located in the npm CLI's bundled dependencies, none in the application's
# dependencies. Removing them treats the cause; filtering them out of the
# report would only have treated the symptom.
RUN rm -rf /usr/local/lib/node_modules/npm \
           /usr/local/bin/npm /usr/local/bin/npx \
           /opt/yarn-v* /usr/local/bin/yarn /usr/local/bin/yarnpkg

# Les paquets Alpine de l'image de base ne sont rafraîchis qu'à sa republication,
# qui suit les correctifs de sécurité avec des jours, parfois des semaines de
# retard. Le scan Trivy a ainsi signalé OpenSSL 3.5.7 (CVE-2026-14456, élevée)
# alors que la 3.5.8 était déjà publiée dans les dépôts Alpine. Mettre à jour à
# chaque build ferme cette fenêtre sans attendre l'amont ; seul l'étage final
# est concerné, les deux autres ne sont pas livrés.
RUN apk upgrade --no-cache

USER node
EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD wget --quiet --spider http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "app/server.js"]
