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

# ── Stage 2: prune to production deps + generate Prisma client ────────────────
FROM base AS deployer
WORKDIR /app
COPY --from=builder /app .
RUN pnpm --filter @lavidz/api --prod deploy /deploy

# Generate Prisma client into the flat node_modules of the deploy output.
# pnpm deploy creates a traditional flat node_modules (not virtual store),
# so prisma generate will write to /deploy/node_modules/.prisma/client.
# We use the prisma CLI from the full builder install.
WORKDIR /deploy
RUN /app/node_modules/.bin/prisma generate \
    --schema=/app/packages/database/prisma/schema.prisma

# ── Stage 3: minimal production image ─────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Production node_modules + generated Prisma client (from deployer)
COPY --from=deployer /deploy .

# dist/ is in .gitignore so pnpm deploy excludes it — copy explicitly
COPY --from=builder /app/apps/api/dist ./dist

# Prisma schema (needed for prisma migrate deploy at startup)
COPY --from=builder /app/packages/database/prisma ./prisma

EXPOSE 3001
CMD ["node", "dist/main"]
