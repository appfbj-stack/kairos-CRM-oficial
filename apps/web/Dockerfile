# =====================================================
# Kairos CRM — Web (Next.js) — Dockerfile
# =====================================================
FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache openssl
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# Copia tudo (workspace + lockfile)
COPY . .

ENV CI=true
# Instala deps
RUN pnpm install --no-frozen-lockfile

# Builda shared (necessário p/ web usar @kairos-crm/shared)
RUN pnpm --filter @kairos-crm/shared build

# Builda o Next.js (gera .next/standalone + .next/static)
ENV NEXT_TELEMETRY_DISABLED=1
# API interna (dentro do dokploy-network) — server-side fetch
ENV NEXT_PUBLIC_API_URL=http://kairos-crm-api:4000
ENV INTERNAL_API_URL=http://kairos-crm-api:4000
RUN pnpm --filter @kairos-crm/web build && \
    cp -r /app/apps/web/.next/static /app/apps/web/.next/standalone/apps/web/.next/ 2>&1 | tail -3 && \
    ls /app/apps/web/.next/standalone/apps/web/.next/

ENV NODE_ENV=production
EXPOSE 3000
ENV PORT=3000

# Standalone output (Next.js gera em apps/web/.next/standalone/)
CMD ["sh", "-c", "cd /app/apps/web/.next/standalone && node apps/web/server.js"]
