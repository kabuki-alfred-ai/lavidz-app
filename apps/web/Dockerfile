FROM node:22-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# ── Stage 1: install all deps + build ─────────────────────────────────────────
FROM base AS builder
WORKDIR /app

ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_ADMIN_SECRET
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_ADMIN_SECRET=$NEXT_PUBLIC_ADMIN_SECRET

COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm --filter @lavidz/database run db:generate
RUN pnpm --filter @lavidz/web build

# ── Stage 2: production runner — Debian slim (glibc, required for chrome-headless-shell) ──
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

# ffmpeg + Chrome headless shell system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libnss3 \
    libdbus-1-3 \
    libatk1.0-0 \
    libgbm1 \
    libasound2 \
    libxrandr2 \
    libxkbcommon0 \
    libxfixes3 \
    libxcomposite1 \
    libxdamage1 \
    libatk-bridge2.0-0 \
    libpango-1.0-0 \
    libcairo2 \
    libcups2 \
    && rm -rf /var/lib/apt/lists/*

# Standalone bundle — self-contained Node.js server
COPY --from=builder /app/apps/web/.next/standalone ./

# Static assets
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static

# Public folder (images, fonts, etc.)
COPY --from=builder /app/apps/web/public ./apps/web/public

# Remotion TypeScript sources (needed for bundler at runtime)
COPY --from=builder /app/apps/web/src/remotion ./apps/web/src/remotion

# Remotion native compositor binaries (not included in standalone bundle)
COPY --from=builder /app/node_modules/.pnpm/@remotion+compositor-linux-x64-gnu@4.0.438 ./node_modules/.pnpm/@remotion+compositor-linux-x64-gnu@4.0.438

# Download Remotion chrome-headless-shell at image build time
RUN node --input-type=module <<'EOF'
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const candidates = [
  '/app/node_modules/@remotion/renderer',
  '/app/apps/web/node_modules/@remotion/renderer',
];
let mod;
for (const p of candidates) {
  try { mod = require(p); break; } catch {}
}
if (!mod) { console.error('Could not find @remotion/renderer'); process.exit(1); }
await mod.ensureBrowser();
console.log('Remotion browser ready');
EOF

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
CMD ["node", "apps/web/server.js"]
