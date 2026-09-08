# =====================================================
# Kairos CRM — API (Fastify) — Dockerfile single stage
# =====================================================
FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache openssl
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# Copia tudo (incluindo pnpm-lock.yaml)
COPY . .

# Instala deps
RUN pnpm install --frozen-lockfile

# Gera Prisma client
RUN pnpm --filter @kairos-crm/database prisma generate

# Builda database + shared (produção precisa de JS compilado)
RUN pnpm --filter @kairos-crm/database build
RUN pnpm --filter @kairos-crm/shared build

# Builda o API
RUN pnpm --filter @kairos-crm/api build

ENV NODE_ENV=production
EXPOSE 4000

# Limpa cache do pnpm
RUN pnpm store prune

# Roda o app
CMD ["node", "apps/api/dist/server.js"]
