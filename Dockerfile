## deps/builder usano l'immagine Node "piena" (basata su buildpack-deps),
## non -slim: include già gcc/g++/make/python3, necessari per compilare
## better-sqlite3 (driver SQLite nativo di Prisma 7). Scartata dal multi-stage
## build, non finisce mai nell'immagine di produzione (vedi stage runner).
FROM node:24 AS deps
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm install

FROM node:24 AS builder
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV DATABASE_URL="file:/data/app.db"
RUN npx prisma generate
RUN npm run build

FROM node:24-slim AS runner
WORKDIR /app
## libstdc++6 è richiesta a runtime dal binario nativo di better-sqlite3
## (compilato nello stage builder); openssl serve ai binari di Prisma.
RUN apt-get update -y && apt-get install -y openssl libstdc++6 && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production

RUN groupadd -g 1001 nodejs && useradd -u 1001 -g nodejs -m brokenpanel

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/src/generated ./src/generated
COPY docker-entrypoint.sh ./docker-entrypoint.sh

RUN chmod +x docker-entrypoint.sh \
  && mkdir -p /data /app/uploads \
  && chown -R brokenpanel:nodejs /app /data

USER brokenpanel
EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["npm", "start"]
