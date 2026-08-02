# Componenti da monitorare

Inventario dei componenti chiave del progetto, con versione attuale, dove sono
"pinnati" e vincoli noti. Serve per poter chiedere in una sessione futura
"controlla se c'è qualcosa da aggiornare" senza dover rileggere tutto il
codice da zero. Aggiorna questo file ogni volta che una versione cambia
davvero (non è un changelog: riflette solo lo stato attuale + i vincoli).

Non duplica PROJECT.md (che spiega architettura e scelte progettuali) — qui
c'è solo la tabella "cosa gira su cosa, con che versione, con che limiti".

## Runtime / immagine Docker

| Componente | Versione attuale | Dove è pinnato | Note |
|---|---|---|---|
| Node.js (Docker) | `node:24` (build) / `node:24-slim` (runtime) | `Dockerfile` | Node 24 = Active LTS più recente al momento della scelta. Node 20 è EOL (fine supporto 2026-04-30, già passato), va evitato come base image. Ricontrollare quando Node 24 uscirà da Active LTS. |
| Node.js (locale, sandbox dev) | v26.5.0 (ambiente di sviluppo, non l'immagine Docker) | n/a — non pinnato in repo | Solo l'ambiente locale di sviluppo; l'immagine Docker resta la fonte di verità per la produzione. |
| Debian base (`-slim`) | ereditata da `node:24-slim` | `Dockerfile` | Richiede `openssl` + `libstdc++6` installati esplicitamente (Prisma engine + `better-sqlite3` nativo). |

## Framework applicativo

| Componente | Versione attuale | Dove è pinnato | Note |
|---|---|---|---|
| Next.js | `16.2.12` | `package.json` | App Router + Turbopack. |
| React / React DOM | `19.2.8` (esatta, non `^`) | `package.json` | Pinnata esatta di proposito (non `^`) — verificare se serve ancora al prossimo bump. |
| NextAuth (Auth.js) | `^5.0.0-beta.32` | `package.json` | Ancora in beta a monte — controllare se è uscita una v5 stabile prima di aggiornare, potrebbe cambiare API. |
| Tailwind CSS | `^4` | `package.json` | Via `@tailwindcss/postcss`. |
| TypeScript | `^5` (attualmente 5.9.x) | `package.json` | **TypeScript 7 testato e scartato**: rompe sia `typescript-eslint` (non supporta ancora TS7) sia la build Next.js (richiede un'API del compiler che TS7 — il nuovo compiler nativo Go — non espone ancora). Ritestare quando l'ecosistema si aggiorna. |
| ESLint | `^9` (attualmente 9.x) | `package.json` | **ESLint 10 testato e scartato**: `eslint-plugin-react` (via `eslint-config-next`) chiama `context.getFilename()`, rimosso in ESLint 10 → crash `TypeError: contextOrFilename.getFilename is not a function`. Ritestare quando `eslint-config-next`/`eslint-plugin-react` si aggiornano. |
| npm | quella imbustata nell'immagine `node:24` | `Dockerfile` (indiretto) | Il warning "New major version of npm available" visto nei build log è npm che segnala se stesso, non un pacchetto del progetto — non richiede azione a meno di voler aggiornare npm nell'immagine base. |

## Database / ORM

| Componente | Versione attuale | Dove è pinnato | Note |
|---|---|---|---|
| Prisma (CLI + client) | `^7.9.1` | `package.json`, `prisma.config.ts` | Migrazione da v6 già fatta. Architettura v7: niente `url` in `schema.prisma`, serve `prisma.config.ts` + `adapter` esplicito nel costruttore di `PrismaClient`. Il CLI **non** carica `.env` da solo (serve `import "dotenv/config"` esplicito). |
| `@prisma/adapter-better-sqlite3` | `^7.9.1` | `package.json` | Driver adapter richiesto da Prisma 7 per SQLite. |
| `better-sqlite3` (nativo) | risolto in automatico da npm | `package-lock.json` | Compilazione nativa — per questo il Dockerfile usa `node:24` pieno (con gcc/g++/make/python3) negli stage `deps`/`builder`, non `-slim`. |
| SQLite | via `better-sqlite3` | — | DB file singolo, path da `DATABASE_URL`. In Prisma 7 i path relativi si risolvono rispetto alla root del progetto (dove sta `prisma.config.ts`), non rispetto a `prisma/` come in v6 — occhio se si tocca `DATABASE_URL`. |

## Sicurezza / upload

| Componente | Versione attuale | Dove è pinnato | Note |
|---|---|---|---|
| `dompurify` + `jsdom` | `^3.4.12` / `^30.0.1` | `package.json` | Sanitizzazione SVG caricati (loghi) contro XSS (`script`, `onload`, `foreignObject`). |
| `image-size` | `^2.0.2` | `package.json` | Validazione "magic bytes" per confermare che il formato reale di un'immagine raster corrisponda al MIME dichiarato. |
| `bcryptjs` | `^3.0.3` | `package.json` | Hashing password, cost factor 12 in tutto il codice (`src/lib/prisma.ts`-adiacenti, `seed.ts`, API cambio password). |
| Rate limiting login | in-memory, nessuna dipendenza esterna | `src/lib/login-rate-limit.ts` | Scelta deliberata (single-admin app) — non serve Redis/altro. Si azzera al riavvio del processo, accettabile per questo caso d'uso. |

## Immagini / thumbnail

| Componente | Versione attuale | Dove è pinnato | Note |
|---|---|---|---|
| `sharp` | `^0.35.3` | `package.json` | Genera thumbnail WebP (480px larghezza) per copertine e pagine. Richiede binari nativi precompilati per piattaforma — verificare compatibilità piattaforma ad ogni bump major. |

## Come usare questo file

Quando chiedi "controlla se c'è qualcosa da aggiornare", il punto di partenza
è confrontare la colonna "Versione attuale" con quanto disponibile a monte per
ciascun componente, rileggendo prima le "Note" per capire se un aggiornamento
è già stato tentato e scartato (ed eventualmente ritentarlo se la nota indica
una condizione che nel frattempo potrebbe essersi risolta).
