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
| Node.js (Docker) | `node:24` (build) / `node:24-slim` (runtime) | `Dockerfile` | Node 24 = Active LTS più recente al momento della scelta. Node 20 è EOL (fine supporto 2026-04-30, già passato), va evitato come base image. Riverificato 2026-08-07 sullo schedule ufficiale Node.js: Node 24 resta Active LTS fino al 2026-10-20 (poi Maintenance fino al 2028-04-30); Node 26 è "Current" dal 2026-05-05 ma diventa LTS solo il 2026-10-28 — troppo presto per usarlo come base image di produzione. Ricontrollare dopo il 2026-10-20. |
| Node.js (locale, sandbox dev) | v26.5.0 (ambiente di sviluppo, non l'immagine Docker) | n/a — non pinnato in repo | Solo l'ambiente locale di sviluppo; l'immagine Docker resta la fonte di verità per la produzione. |
| Debian base (`-slim`) | ereditata da `node:24-slim` | `Dockerfile` | Richiede `openssl` + `libstdc++6` installati esplicitamente (Prisma engine + `better-sqlite3` nativo). |

## Framework applicativo

| Componente | Versione attuale | Dove è pinnato | Note |
|---|---|---|---|
| Next.js | `16.3.1` | `package.json` | App Router + Turbopack. Pinnata esatta (senza `^`), come React. Confermata più recente al 2026-08-20. Aggiornata da 16.3.0 a 16.3.1 il 2026-08-18 (solo patch, nessun problema noto sulla 16.3.0 — allineamento all'ultima disponibile; `npm run build` e `npm run lint` puliti dopo il bump). Aggiornata da 16.2.12 il 2026-08-05: la 16.2.12 trascinava (nei suoi `node_modules` interni, non nelle dipendenze dirette del progetto) versioni vulnerabili di `postcss` (XSS/path traversal via `sourceMappingURL`) e `sharp`/libvips (CVE-2026-33327/33328/35590/35591) — `npm audit` segnalava 3 vulnerabilità high. Verificato dopo l'update: `npm audit` pulito, `npm run build` e `npm run lint` ok (solo warning preesistenti). |
| React / React DOM | `19.2.8` (esatta, non `^`) | `package.json` | Pinnata esatta di proposito (non `^`) — verificare se serve ancora al prossimo bump. Confermata più recente al 2026-08-20. |
| NextAuth (Auth.js) | `^5.0.0-beta.32` | `package.json` | Ancora in beta a monte (riverificato 2026-08-20: `beta` resta `5.0.0-beta.32`, e `latest` su npm è ancora la v4 — attenzione, un `npm outdated` "suggerisce" 4.24.15, che sarebbe un downgrade di major, da ignorare) — controllare se è uscita una v5 stabile prima di aggiornare, potrebbe cambiare API. |
| Tailwind CSS | `^4` (risolta a 4.3.3) | `package.json` | Via `@tailwindcss/postcss`. Già alla più recente nel range al 2026-08-20 (4.3.3). |
| TypeScript | `^6` (attualmente 6.0.3) | `package.json` | Aggiornata da `^5` (5.9.x) il 2026-08-07: `typescript-eslint@8.65.0` dichiara `peerDependency typescript: ">=4.8.4 <6.1.0"`, quindi la serie 6.0.x (uscita 2026-03/04, non vista nel check del 2026-08-05) rientra nel range supportato. **TypeScript 7 resta bloccato** invece: fuori dal range `<6.1.0`. Verificato `npm run build` e `npm run lint` puliti dopo il bump (solo warning preesistenti). Ritestare TS7 quando `typescript-eslint` alza il range. Ricontrollato 2026-08-20: `typescript-eslint@8.67.0` (l'ultima) dichiara ancora `typescript: ">=4.8.4 <6.1.0"`, quindi TS 7.0.2 resta fuori range. |
| ESLint | `^9` (attualmente 9.x) | `package.json` | **ESLint 10 ancora bloccato** (ricontrollato 2026-08-07): `typescript-eslint@8.65.0` ora accetta anche `eslint: "^10.0.0"`, ma `eslint-plugin-react@7.37.5` (l'ultima, tirata da `eslint-config-next`) dichiara ancora peer `eslint: "^3...^9.7"`, niente `^10` — è lui il blocco residuo. Ritestare quando `eslint-plugin-react` si aggiorna. Ricontrollato 2026-08-20: `eslint-plugin-react` è ancora fermo a 7.37.5 con lo stesso peer, blocco invariato (ESLint 10.8.1 disponibile a monte). |
| npm | quella imbustata nell'immagine `node:24` | `Dockerfile` (indiretto) | Il warning "New major version of npm available" visto nei build log è npm che segnala se stesso, non un pacchetto del progetto — non richiede azione a meno di voler aggiornare npm nell'immagine base. |
| `@types/node` | `^24` | `package.json` (devDependency) | Solo tipi per il type-checking in dev, non influisce sul runtime. Allineata alla major di Node effettivamente usata in Docker (`node:24`) il 2026-08-05 — prima era rimasta `^20`, disallineata rispetto al runtime reale. **Non aggiornare a `^26`** finché il Dockerfile usa `node:24`: `npm outdated` propone 26.2.0, ma i tipi vanno tenuti sulla major di Node effettivamente in esecuzione (verificato 2026-08-20). |
| `tsx` | `^4.23.12` | `package.json` (devDependency) | Usato per eseguire `prisma/seed.ts` e `prisma/reset-admin-password.ts`. Aggiornata da `^4.23.10` (patch) il 2026-08-10, già alla più recente al 2026-08-20. |

## Database / ORM

| Componente | Versione attuale | Dove è pinnato | Note |
|---|---|---|---|
| Prisma (CLI + client) | `^7.9.1` | `package.json`, `prisma.config.ts` | Migrazione da v6 già fatta. Architettura v7: niente `url` in `schema.prisma`, serve `prisma.config.ts` + `adapter` esplicito nel costruttore di `PrismaClient`. Il CLI **non** carica `.env` da solo (serve `import "dotenv/config"` esplicito). 7.9.1 è ancora l'ultima pubblicata al 2026-08-20. |
| `@prisma/adapter-better-sqlite3` | `^7.9.1` | `package.json` | Driver adapter richiesto da Prisma 7 per SQLite. |
| `better-sqlite3` (nativo) | risolto in automatico da npm | `package-lock.json` | Compilazione nativa — per questo il Dockerfile usa `node:24` pieno (con gcc/g++/make/python3) negli stage `deps`/`builder`, non `-slim`. |
| SQLite | via `better-sqlite3` | — | DB file singolo, path da `DATABASE_URL`. In Prisma 7 i path relativi si risolvono rispetto alla root del progetto (dove sta `prisma.config.ts`), non rispetto a `prisma/` come in v6 — occhio se si tocca `DATABASE_URL`. |

## Sicurezza / upload

| Componente | Versione attuale | Dove è pinnato | Note |
|---|---|---|---|
| `dompurify` + `jsdom` | `^3.4.14` / `^30.0.1` | `package.json` | Sanitizzazione SVG caricati (loghi) contro XSS (`script`, `onload`, `foreignObject`). `dompurify` aggiornata da `^3.4.13` a `^3.4.14` il 2026-08-20 (solo patch, nessun problema noto sulla 3.4.13 — allineamento all'ultima disponibile; `npm run build` e `npm run lint` puliti dopo il bump). `jsdom` già alla più recente al 2026-08-20. |
| `@types/jsdom` | `^30.0.0` | `package.json` (devDependency) | Solo tipi, non runtime. Aggiornata da `^28.0.3` il 2026-08-10 per allinearsi alla major di `jsdom` (`30.x`) effettivamente installata — prima disallineata di 2 major (solo sul type-checking, nessun impatto a runtime). |
| `image-size` | `^2.0.2` | `package.json` | Validazione "magic bytes" per confermare che il formato reale di un'immagine raster corrisponda al MIME dichiarato. **Vulnerabilità nota non risolta a monte** (verificato 2026-08-10): `npm audit` segnala high — GHSA-w3rx-r6r6-pgpr (loop infinito nel parser ICNS) e GHSA-5p2g-fcmc-qvqq (loop infinito nei parser JXL/HEIF) — e `2.0.2` è già l'ultima versione pubblicata, `npm audit fix` non ha nulla da proporre. Rischio mitigato su due fronti: (1) solo l'admin autenticato può caricare file (nessun endpoint di upload pubblico); (2) dal 2026-08-20 `validateRasterImage()` fa un **pre-check sui magic byte** prima di chiamare `imageSize()`, così i parser vulnerabili (ICNS/JXL/HEIF) non vengono mai raggiunti — il whitelist sui MIME da solo **non** bastava, perché `image-size` prova i parser di tutti i formati che supporta e il confronto col MIME dichiarato avveniva solo dopo (verificato: un header ICNS dichiarato `image/png` veniva parsato e restituiva `type: "icns"`). Senza quel pre-check il rischio sarebbe stato l'intero sito bloccato — `imageSize()` è sincrona, quindi un loop infinito bloccherebbe l'event loop di Node, e `restart: unless-stopped` non interverrebbe (processo appeso, non crashato). Ricontrollare ad ogni futuro giro di controllo componenti se è uscita una patch upstream. Ricontrollato 2026-08-20: nessuna release nuova (l'ultima pubblicazione del pacchetto risale ad aprile 2025), situazione invariata. |
| `nanoid` (transitiva, via `postcss` ← `@tailwindcss/postcss` e `next`) | `3.3.18` | `package-lock.json` (non diretta) | `npm audit` segnalava high il 2026-08-10: GHSA-2v37-7h3g-55p8, loop infinito con generatori custom e `size: 0` (versioni `<3.3.17`). Risolta con `npm audit fix` (bump del lockfile da `3.3.16` a `3.3.18`, rientra comunque nel range `^3.3.16` dichiarato da `postcss`, nessuna modifica a `package.json`). |
| `bcryptjs` | `^3.0.3` | `package.json` | Hashing password, cost factor 12 in tutto il codice (`src/lib/prisma.ts`-adiacenti, `seed.ts`, API cambio password). |
| Rate limiting login | in-memory, nessuna dipendenza esterna | `src/lib/login-rate-limit.ts` | Scelta deliberata (single-admin app) — non serve Redis/altro. Si azzera al riavvio del processo, accettabile per questo caso d'uso. |
| `deepmerge-ts` (transitiva, via `prisma` → `@prisma/config`) | `<8.0.0` | `package-lock.json` (non diretta) | **Vulnerabilità nota non risolvibile senza regressione** (verificato 2026-08-18): `npm audit` segnala high — GHSA-ggr8-5vv4-36mx, stack exhaustion nel merge di grafi di oggetti ricorsivi. Attenzione: `prisma` sta in `dependencies` (non `devDependencies`) perché `docker-entrypoint.sh` esegue `npx prisma db push` ad ogni avvio, quindi la dipendenza **finisce nell'immagine di produzione**. `npm audit fix --force` proporrebbe il downgrade a `prisma@6.12.0`: **da non fare**, annullerebbe la migrazione a Prisma 7. Prisma 7.9.1 è già l'ultima pubblicata a monte. Rischio pratico ~nullo: il merge riguarda il file di configurazione del CLI (`prisma.config.ts`), non input che arrivino da fuori. Ricontrollare ad ogni giro se Prisma ha aggiornato `@prisma/config`. Ricontrollato 2026-08-20: invariato, Prisma è ancora alla 7.9.1. |
| `js-yaml` (transitiva, via `eslint` → `@eslint/eslintrc`) | `4.3.1` | `package-lock.json` (non diretta) | `npm audit` segnalava high il 2026-08-07: CVE-2026-59870, quadratic CPU consumption nella risoluzione `!!omap` (3.x e 4.x < 4.3.1). Risolta con `npm audit fix` (bump automatico del lockfile, nessuna modifica a `package.json`). Solo devDependency (eslint), non tocca il runtime di produzione. |

## Immagini / thumbnail

| Componente | Versione attuale | Dove è pinnato | Note |
|---|---|---|---|
| `sharp` | `^0.35.3` | `package.json` | Genera thumbnail WebP (480px larghezza) per copertine e pagine. Richiede binari nativi precompilati per piattaforma — verificare compatibilità piattaforma ad ogni bump major. Già alla più recente al 2026-08-20 (da non confondere con la copia interna vulnerabile che Next.js portava con sé prima dell'update a 16.3.0, vedi sopra). |

## Come usare questo file

Quando chiedi "controlla se c'è qualcosa da aggiornare", il punto di partenza
è confrontare la colonna "Versione attuale" con quanto disponibile a monte per
ciascun componente, rileggendo prima le "Note" per capire se un aggiornamento
è già stato tentato e scartato (ed eventualmente ritentarlo se la nota indica
una condizione che nel frattempo potrebbe essersi risolta).
