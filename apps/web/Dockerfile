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
RUN pnpm --filter @lavidz/database run db:generate
RUN pnpm --filter @lavidz/web build

# Collect Remotion compositor binaries into a known path for the runner stage
RUN mkdir -p /remotion-bins && \
    find /app/node_modules/.pnpm -maxdepth 1 -type d -name "@remotion+compositor*" \
      -exec cp -r {} /remotion-bins/ \;

# ── Stage 2: minimal production image (Next.js standalone) ────────────────────
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache ffmpeg

# Standalone bundle — self-contained Node.js server
COPY --from=builder /app/apps/web/.next/standalone ./

# Static assets must be served alongside the standalone server
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static

# Remotion bundler needs the TypeScript sources at runtime
COPY --from=builder /app/apps/web/src/remotion ./apps/web/src/remotion

# Remotion compositor binaries — not included in standalone output but required at runtime
COPY --from=builder /remotion-bins /app/node_modules/.pnpm/

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
CMD ["node", "apps/web/server.js"]
