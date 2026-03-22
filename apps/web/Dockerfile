FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# ── Stage 1: install all deps + build ─────────────────────────────────────────
FROM base AS builder
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @lavidz/web build

# ── Stage 2: minimal production image (Next.js standalone) ────────────────────
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Standalone bundle — self-contained Node.js server
COPY --from=builder /app/apps/web/.next/standalone ./

# Static assets must be served alongside the standalone server
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static

# Public assets (may be empty but copy anyway)
COPY --from=builder /app/apps/web/public ./apps/web/public

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
CMD ["node", "apps/web/server.js"]
