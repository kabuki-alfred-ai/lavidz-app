FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# ── Stage 1: install all deps + build ─────────────────────────────────────────
FROM base AS builder
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @lavidz/database run db:generate
RUN pnpm --filter @lavidz/api build

# ── Stage 2: prune to production deps via pnpm deploy ─────────────────────────
FROM base AS deployer
WORKDIR /app
COPY --from=builder /app .
RUN pnpm --filter @lavidz/api --prod deploy /deploy

# ── Stage 3: minimal production image ─────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Production node_modules (flat, no dev deps, workspace packages inlined)
COPY --from=deployer /deploy .

# dist/ is in .gitignore so pnpm deploy excludes it — copy explicitly
COPY --from=builder /app/apps/api/dist ./dist

# Prisma generated client (pnpm deploy reinstalls @prisma/client but doesn't run generate)
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Prisma schema (needed for prisma migrate deploy at startup)
COPY --from=builder /app/packages/database/prisma ./prisma

EXPOSE 3001
CMD ["node", "dist/main"]
