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

# ── Stage 2: minimal production image ─────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy pnpm virtual store — relative symlinks resolve correctly in the runner.
# This includes the generated Prisma client from the db:generate step above.
COPY --from=builder /app/node_modules ./node_modules

# dist/ is in .gitignore so it's not in node_modules — copy explicitly
COPY --from=builder /app/apps/api/dist ./dist

# Prisma schema (needed for prisma migrate deploy at startup)
COPY --from=builder /app/packages/database/prisma ./prisma

EXPOSE 3001
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy --schema=prisma/schema.prisma && node dist/main"]
