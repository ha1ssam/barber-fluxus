# App Next.js (painel, página das lojas e API). Imagem única usada também pelo worker.
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# O seed de demonstração vira um .cjs para rodar na imagem final (sem tsx).
# Só o Prisma fica de fora do pacote: o resto (como bcryptjs) não existe na imagem final.
RUN npx prisma generate && npx next build \
  && npx esbuild prisma/seed.ts --bundle --platform=node --format=cjs --external:@prisma/client --external:.prisma/client --outfile=prisma/seed.cjs

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0 UPLOAD_DIR=/data/uploads
RUN npm install -g prisma@6.19.3 && npm cache clean --force && mkdir -p /data/uploads && chown -R node:node /data
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/scripts/worker.mjs ./scripts/worker.mjs
USER node
EXPOSE 3000
# Aplica as migrações, cria a loja de demonstração se SEED_DEMO=1 e sobe o servidor.
CMD ["sh", "-c", "prisma migrate deploy && if [ \"$SEED_DEMO\" = 1 ]; then node prisma/seed.cjs || echo \"AVISO: falha ao criar a loja de demonstracao\"; fi && node server.js"]
