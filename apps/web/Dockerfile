FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# ── Stage 1: install all deps + build ─────────────────────────────────────────
FROM base AS builder
WORKDIR /app

# Build-time env vars (NEXT_PUBLIC_* are baked into the client bundle)
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_ADMIN_SECRET
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_ADMIN_SECRET=$NEXT_PUBLIC_ADMIN_SECRET

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

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
CMD ["node", "apps/web/server.js"]
