# Broken Panel — contesto di progetto

Questo file esiste per permettere a chiunque (umano o AI) riprenda il progetto in una
sessione nuova di orientarsi rapidamente, senza dover rileggere tutto il codice da zero.
Il [README.md](README.md) spiega *come far girare* il progetto; questo file spiega
*perché è fatto così* e dove sono i punti delicati.

## Cos'è

Broken Panel è la casa di produzione fumetti di zedred: romanzi classici di pubblico
dominio (I tre moschettieri, Dracula, La maschera della morte rossa, ecc.) trasformati
in fumetti con l'AI, ognuno in uno stile grafico diverso. La piattaforma è tipo
GlobalComix: un solo admin (zedred) pubblica i fumetti, i lettori li sfogliano con un
effetto di zoom automatico sulle vignette.

Repo: https://github.com/zedred79/broken-panel (privato)
Deploy target: server Ubuntu di zedred, Docker + reverse proxy SWAG già esistente.

## Stack e perché

- **Next.js 16** (App Router, Turbopack), **React 19**, **Tailwind CSS 4**.
  Scaffoldato con `create-next-app`. **Attenzione**: questa versione ha breaking change
  rilevanti rispetto alla conoscenza "di default" di un modello — vedi
  [AGENTS.md](AGENTS.md) e la sezione "Insidie note" più sotto.
- **Prisma 7** + **SQLite**, con driver adapter (`@prisma/adapter-better-sqlite3`).
  Prisma 7 ha cambiato architettura rispetto alle versioni precedenti: niente più `url`
  nello schema, la connessione si configura in `prisma.config.ts` (per i comandi CLI:
  `generate`, `db push`, ecc.) e si passa esplicitamente un `adapter` al costruttore di
  `PrismaClient` (vedi `src/lib/prisma.ts` e `prisma/seed.ts`). Due insidie scoperte
  migrando: (1) un `DATABASE_URL` relativo in `prisma.config.ts` si risolve rispetto alla
  **root del progetto**, non più rispetto a `prisma/` come prima — da qui
  `file:./prisma/dev.db` invece di `file:./dev.db` in sviluppo; (2) il CLI di Prisma 7
  **non carica più `.env` automaticamente** (a differenza delle versioni precedenti), per
  questo sia `prisma.config.ts` sia `prisma/seed.ts` importano esplicitamente
  `dotenv/config` in cima — senza, `DATABASE_URL` risulterebbe `undefined` in quei
  contesti (Next.js invece carica `.env` da solo, quindi l'app in sé non ne risente).
  L'adapter richiede `better-sqlite3`, un modulo nativo compilato — vedi sotto per come
  questo influenza la scelta dell'immagine Docker.
- **NextAuth v5 (Auth.js)** con provider Credentials, sessione JWT. Un solo utente admin,
  creato via seed da `ADMIN_EMAIL`/`ADMIN_PASSWORD`. Non c'è registrazione, non c'è
  gestione multi-utente: è una scelta deliberata (uso singolo).
- **Docker** (Dockerfile multi-stage). Gli stage `deps`/`builder` usano `node:24` (immagine
  "piena", basata su `buildpack-deps`) invece di `-slim`: include già gcc/g++/make/python3,
  necessari per compilare `better-sqlite3` a install time. Lo stage `runner` (quello che
  finisce in produzione) resta `node:24-slim` — i compilatori restano confinati agli stage
  intermedi, scartati dal multi-stage build, zero impatto su dimensione/sicurezza
  dell'immagine finale. `runner` installa anche `libstdc++6` via apt (richiesta a runtime
  dal binario nativo di `better-sqlite3`) oltre a `openssl` (richiesta dai binari di
  Prisma). Node 20 è stato abbandonato perché ormai end-of-life (rimosso dal repository
  immagini ufficiali attivamente mantenuto).
- **docker-compose.yml** con porta host non standard (`HOST_PORT`, default 48217, per non
  entrare in conflitto con gli altri servizi già sul server) e rete esterna condivisa con
  SWAG. `image: zedred/broken-panel:latest` (repository **privato** su Docker Hub) è la
  fonte primaria in produzione: il server fa solo `docker compose pull && up -d`, senza
  bisogno dei sorgenti né dei tool di compilazione — `build: .` resta nel file solo per
  chi vuole ripubblicare una nuova versione (`docker compose build && docker compose
  push`) o buildare direttamente sul server come fallback. Database e upload vivono in
  `./data/db` e `./data/uploads` (cartelle mappate sull'host, non volumi Docker nominati
  — backup con un `tar` diretto, niente più bisogno di un container temporaneo per
  leggerle). **Insidia**: il container gira come utente non-root (uid 1001) — `./data`
  deve appartenergli fin da subito (`chown -R 1001:1001 data` una tantum prima del primo
  avvio), altrimenti l'app non riesce a scrivere né il DB né gli upload.

## Struttura del progetto

```
prisma.config.ts               Config Prisma 7 (datasource per i comandi CLI, vedi sopra)
prisma/schema.prisma           Modelli: User, Comic, Page, Panel, SiteSetting
prisma/seed.ts                 Crea/aggiorna l'utente admin da env

src/lib/
  auth.ts                      Config NextAuth (provider Credentials, callback JWT/session,
                                rate-limit sui tentativi di login, vedi sotto)
  login-rate-limit.ts          Contatore in-memory dei tentativi di login falliti
  prisma.ts                    Singleton PrismaClient (con adapter, vedi sopra)
  reading-progress.ts          Persistenza lato client (localStorage) dell'ultima pagina
                                letta di ogni fumetto — vedi sezione reader più sotto
  require-admin.ts             Helper per proteggere le API route
  site-config.ts               Testi homepage/footer configurabili da env
  slugify.ts, uploads.ts       Utility (slug univoci, salvataggio/validazione/sanificazione
                                immagini su disco, generazione thumbnail — vedi sotto)

src/proxy.ts                  Ex "middleware.ts" (rinominato in Next 16, vedi sotto).
                               Protegge /admin/* redirigendo a /login se non autenticati.

src/app/(site)/                Sito pubblico: home, /comics/[slug]
src/app/admin/                 Area admin (dashboard, editor fumetto, editor vignette)
src/app/api/                   Route handler REST per comics/pages/panels
src/app/login/                 Login admin (server action + form)
src/app/read/[slug]/           Il reader immersivo (componente client ComicReader)

src/components/admin/          PanelEditor (slicer poligoni), PageManager, ComicForm,
                                DeleteComicButton, AdminNav, SiteSettingsForm,
                                ChangePasswordForm
src/components/reader/         ComicReader (la logica di zoom/maschera)
src/components/site/           Navbar, Footer, ComicCard, ContinueReadingLink

src/generated/prisma/          Client Prisma generato — NON committato (vedi .gitignore),
                                rigenerato ad ogni `npx prisma generate` / build Docker.
```

## Modello dati (prisma/schema.prisma)

```
User   { email, passwordHash }                         — un solo record, l'admin
Comic  { slug, title, sourceWork, author, description,
         style, coverImage, coverThumbnail,
         status: draft|published }
Page   { comicId, order, imageUrl, thumbnailUrl,        — una tavola A4 caricata
         width, height }
Panel  { pageId, order, points: JSON stringify di       — poligono libero di una vignetta,
         [{x,y}, ...] in percentuale 0-100 }              coordinate % relative all'immagine
SiteSetting { id: "singleton", headerLogo?, heroLogo? } — riga unica, loghi personalizzati
```

`coverThumbnail`/`thumbnailUrl` (WebP 480px, generati all'upload — vedi sezione hardening
upload più sotto) sono nullable perché aggiunti con un `db push` additivo: i fumetti/pagine
caricati prima di questa modifica hanno questi campi `NULL` e continuano a funzionare — i
componenti che li usano fanno fallback all'originale (`thumbnailUrl ?? imageUrl`), nessun
backfill retroattivo è stato fatto.

I punti dei poligoni sono salvati come **percentuali** (0-100) dell'immagine, non pixel
assoluti — è la scelta chiave che rende tutto il resto (editor + reader) indipendente
dalla risoluzione con cui viene mostrata l'immagine.

## Il pezzo più delicato: l'effetto zoom del reader

`src/components/reader/ComicReader.tsx`. L'idea:

1. La pagina viene mostrata "adattata" al contenitore (`fit = min(containerW/imgW,
   containerH/imgH)`), centrata con `offsetX0/offsetY0`.
2. Per zoomare su una vignetta, si calcola il bounding box del suo poligono (in pixel,
   nello spazio "immagine adattata"), si calcola una scala che lo fa entrare nel
   contenitore (con un margine del 8%), e si applica `transform: translate(tx,ty)
   scale(s)` con `transform-origin: 0 0` sul wrapper che contiene sia l'`<img>` che
   l'overlay SVG di oscuramento — così immagine e maschera si muovono insieme,
   sincronizzate.
3. L'oscuramento è un `<rect>` SVG nero con `mask`: la maschera è bianca ovunque tranne
   che nel poligono della vignetta corrente (nero = trasparente = vignetta visibile).
4. Navigazione: `panelIndex === -1` = pagina intera (nessun oscuramento). Avanzando si
   entra nel panel 0, poi 1, ecc.; oltre l'ultimo panel si passa alla pagina successiva
   (di nuovo con `panelIndex = -1`); oltre l'ultima pagina si torna a `/comics/[slug]`.
5. **Salto rapido a una pagina**: il pulsante "Pagina X/Y ▾" in alto apre un overlay
   (`pickerOpen`) con una griglia di miniature di tutte le pagine (usa `thumbnailUrl`
   se presente, fallback su `imageUrl` per i dati legacy — vedi sotto). Cliccando
   una miniatura si chiama `jumpToPage(index)`: imposta `pageIndex` e resetta
   `panelIndex = -1` (arrivo a pagina intera, come da flusso normale). Serve a non dover
   rifare tutte le vignette delle pagine già lette per riprendere più avanti. Chiusura
   con ✕, click fuori dalla griglia, o Esc; mentre il picker è aperto le frecce ← → e lo
   spazio non navigano (guardia `if (pickerOpen) return;` nell'handler keydown).
6. **Persistenza del progresso di lettura** (`src/lib/reading-progress.ts`): ad ogni
   cambio pagina il `pageIndex` viene salvato in `localStorage` per slug del fumetto
   (lato client, non sul server — non ci sono account lettore in questo sito, quindi non
   c'è a chi legare un progresso lato server; è anche per questo che non serve alcuna
   configurazione sul reverse proxy SWAG davanti al servizio). Viene cancellato quando si
   arriva in fondo al fumetto. `ComicReader` accetta un `initialPageIndex` (clampato ai
   limiti reali) valorizzato da `?page=` nella query string di `/read/[slug]`.
   `src/components/site/ContinueReadingLink.tsx`, sulla pagina dettaglio fumetto, mostra
   "Continua da pagina X" + "Ricomincia dall'inizio" se trova un progresso salvato valido,
   altrimenti il solito "Leggi ora" — legge il `localStorage` con `useSyncExternalStore`
   (non `useEffect`+`useState`, che darebbe un warning React e un mismatch di idratazione
   più difficile da gestire bene). Granularità a livello di pagina, non di vignetta.

**Insidia trovata e corretta**: la dimensione del contenitore veniva letta solo via
`ResizeObserver`, che in alcuni contesti (pannelli non compositati/non visibili) non
scatta mai. È stato aggiunto un fallback sincrono (`el.clientWidth/clientHeight` letto
subito in `useEffect`, prima ancora che l'observer scatti) — senza questo, il reader
resta bianco/vuoto finché non arriva un resize reale.

## L'editor vignette (PanelEditor)

`src/components/admin/PanelEditor.tsx`. L'admin clicca punti su un `<svg>` overlaid
sopra l'immagine per disegnare un poligono libero (non solo rettangoli); chiude il
poligono con doppio click o cliccando vicino al primo punto. I vertici di un poligono
selezionato sono trascinabili. L'ordine dei poligoni nell'array = ordine di lettura nel
reader (riordinabile con i pulsanti ↑/↓). Salva tutto in un colpo solo via
`PUT /api/pages/[id]/panels` (cancella e ricrea tutti i Panel di quella pagina).

## Come sono serviti i contenuti caricati (pagine, copertine, loghi)

**Insidia importante, già scattata una volta**: i file caricati dall'admin (tavole,
copertine, loghi) NON vengono salvati in `public/uploads` come si potrebbe pensare.
`next start` (il server di produzione) indicizza la cartella `public/` **una sola volta
all'avvio del processo** — un file scritto lì mentre il server è già in esecuzione
risulta 404 finché il processo non viene riavviato. Verificato empiricamente: stesso
file, 404 prima del riavvio del processo, 200 dopo, senza nemmeno rebuildare.

Per questo lo storage vive **fuori** da `public/`, in `./uploads` (root del progetto,
sovrascrivibile con `UPLOADS_DIR`, in Docker `/app/uploads` montato come volume), e viene
servito da una route dinamica dedicata, `src/app/uploads/[filename]/route.ts`, che legge
il file dal disco **ad ogni richiesta** (`readFile`, non un manifest statico). L'URL
pubblico resta identico a prima (`/uploads/xxx.ext`), quindi nessuna migrazione dei dati
già salvati in DB è necessaria. `src/lib/uploads.ts` esporta `UPLOADS_ROOT`, usato sia da
chi scrive i file (`savePageImage`, `saveCoverImage`, `saveLogoImage`) sia dalla route che
li legge.

**Se in futuro serve salvare altri tipi di file caricati dall'utente, riusa questo
pattern — non tornare a scrivere dentro `public/`.**

## Hardening di sicurezza (upload e login)

Tutto qui sotto è stato aggiunto dopo un audit di sicurezza del codice iniziale, che
accettava upload senza limiti né validazione del contenuto reale e non aveva alcun
rate-limit sui tentativi di login.

- **Limiti di dimensione** per tipo di upload: 20MB tavole (spesso render AI ad alta
  risoluzione), 8MB copertine, 2MB loghi (icone piccole). Controllati su `file.size`
  prima di leggere il buffer in memoria.
- **Validazione sul contenuto reale, non sul Content-Type dichiarato dal client**: per i
  formati raster (PNG/JPEG/WebP), `validateRasterImage()` usa `image-size` per leggere il
  formato dai byte reali (magic number) e verifica che corrisponda al MIME dichiarato —
  un file rinominato con estensione/MIME falsi viene rifiutato con 400 invece di essere
  salvato as-is.
- **Sanificazione degli SVG** (solo i loghi accettano `image/svg+xml`): `sanitizeSvg()`
  usa DOMPurify (via `jsdom`, uso server-side) per rimuovere `<script>`,
  gestori `onload`/`onclick`, `<foreignObject>` e ogni altro vettore XSS prima di scrivere
  il file su disco — un SVG caricato per errore (o con l'account admin compromesso)
  potrebbe altrimenti eseguire script nell'origine del sito se aperto direttamente
  (l'`<img>` normale invece sandboxa già l'esecuzione).
- **Generazione thumbnail**: `saveThumbnail()` (via `sharp`) genera una versione WebP da
  480px di larghezza per ogni tavola/copertina caricata, usata nelle griglie (vedi sopra
  il modello dati). Il reader in modalità lettura/zoom continua a usare l'originale a
  piena risoluzione.
- **Cleanup dei file orfani**: `deleteUploadedFile()` è chiamata da tutte le route che
  eliminano o sostituiscono un fumetto/pagina/logo (comic, page, cover, thumbnail incluso)
  — prima non veniva ripulito nulla e i file restavano su disco per sempre. Ignora
  silenziosamente URL esterni a `/uploads/` (i loghi di default bundlati in `public/`) e
  file già assenti.
- **Rate-limit sul login** (`src/lib/login-rate-limit.ts`, usato in `src/lib/auth.ts`):
  5 tentativi falliti / 15 minuti per email, poi anche la password corretta viene
  rifiutata finché la finestra non scade. In-memory (si resetta a un riavvio del
  container) — scelta proporzionata a un'app a singolo processo con un solo account
  admin, non serve infrastruttura esterna.

## Route API principali

- `POST /api/comics`, `GET/PATCH/DELETE /api/comics/[id]` — CRUD fumetto (multipart
  form-data, gestisce anche l'upload della copertina)
- `POST /api/comics/[id]/pages` — upload di una tavola (multipart, legge le dimensioni
  reali dell'immagine con la libreria `image-size`)
- `PATCH /api/pages/[id]` (`{direction: "up"|"down"}`), `DELETE /api/pages/[id]`
- `GET/PUT /api/pages/[id]/panels` — legge/sostituisce l'elenco vignette di una pagina
- `GET/PUT /api/site-settings` — loghi personalizzati (vedi sotto)
- `POST /api/account/password` — cambio password admin (vedi sotto)

Tutte protette da `requireAdmin()` (controllo sessione NextAuth lato server).

## Cambio password admin

`/admin/settings` (`ChangePasswordForm.tsx`) permette di cambiare la password
dell'admin senza dover rifare il seed/riavviare il container. `POST
/api/account/password` verifica la password attuale con `bcrypt.compare` prima di
accettare quella nuova (minimo 8 caratteri) — senza questo controllo, chiunque avesse
accesso a una sessione già autenticata (es. XSS) potrebbe cambiare la password e
scacciare l'admin legittimo. Dopo il salvataggio il form chiama `signOut()` lato
client per forzare un nuovo login con le nuove credenziali.

**Limite noto**: le sessioni usano JWT stateless (`session: { strategy: "jwt" }` in
`src/lib/auth.ts`) — il token non viene mai ri-verificato contro il DB ad ogni
richiesta, quindi cambiare la password **non invalida altre sessioni già aperte
altrove** (altri browser/dispositivi restano loggati finché il loro token JWT non
scade naturalmente). Per un sito a singolo admin il rischio pratico è basso; una
soluzione completa richiederebbe sessioni lato DB o un claim di versione nel JWT
controllato ad ogni richiesta — non implementata, sproporzionata per questo caso d'uso.

## Loghi personalizzabili (Impostazioni sito)

`/admin/settings` (`SiteSettingsForm.tsx`) permette di caricare due immagini distinte
(header e hero) tramite un unico record `SiteSetting` (id fisso `"singleton"`,
upsert in `PUT /api/site-settings`). Se un campo è `null` si usa il default bundleato
(`/logo-mark.svg`, definito in `src/lib/site-settings.ts`). Formati accettati: PNG,
JPEG, WebP, SVG (`saveLogoImage` in `src/lib/uploads.ts` — a differenza degli upload di
copertine/pagine, qui è ammesso anche `image/svg+xml`). `Navbar.tsx` e la homepage
leggono i loghi correnti con `getSiteSettings()` (query Prisma diretta, non env var —
a differenza dei testi di `site-config.ts`, qui serve un DB perché sono file binari,
non semplici stringhe da mettere in `.env`).

## Variabili d'ambiente (vedi .env.example)

`DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`,
`HOST_PORT`, `SWAG_NETWORK_NAME`, e i testi homepage/footer configurabili
`SITE_HERO_TITLE`, `SITE_HERO_SUBTITLE`, `SITE_FOOTER_TEXT` (letti da
`src/lib/site-config.ts`, con fallback ai testi originali se non impostati). I **loghi**
invece non sono in env: si gestiscono da `/admin/settings` (vedi sopra).

## Insidie note di questa versione di Next.js (leggi anche AGENTS.md)

- `middleware.ts` **non esiste più**: si chiama `proxy.ts` (in `src/`, dato che si usa
  `src/app`). Stessa logica, export diverso.
- `params`/`searchParams` in page.tsx e route.ts sono **sempre Promise**, vanno
  `await`ati.
- Le pagine Server Component che leggono dati "vivi" (query Prisma dirette, non `fetch`)
  **non diventano dinamiche automaticamente** — Next le prerenderizza come statiche in
  build se non c'è nulla che le forza a essere dinamiche. È già successo: homepage e
  dashboard admin venivano congelate al momento del build (nuovi fumetti pubblicati o
  variabili `SITE_*` cambiate non comparivano finché non si rifaceva `next build`). Fix:
  `export const dynamic = "force-dynamic";` in cima al file. **Se aggiungi nuove pagine
  che leggono dal DB e devono mostrare dati sempre aggiornati, ricordati questo export**
  (oppure verifica con `npm run build`: le route dinamiche sono marcate `ƒ`, quelle
  statiche `○`).
- Il progetto è stato migrato a Prisma 7 (vedi sopra) — se aggiorni ulteriormente Prisma,
  ricontrolla la compatibilità di `@prisma/adapter-better-sqlite3` con la nuova versione
  prima di procedere.

## Stato attuale / cosa manca

Fatto: sito pubblico, reader con zoom, salto rapido a una pagina specifica e persistenza
del progresso di lettura tra sessioni (localStorage), area admin completa (CRUD fumetti,
upload pagine, editor vignette, eliminazione fumetti), auth con rate-limit sui tentativi
di login e cambio password da UI, Docker + config SWAG di esempio (immagine pubblicata su
Docker Hub, deploy pull-based con cartelle dati mappate), testi homepage configurabili da
env, loghi header/hero personalizzabili da `/admin/settings`, upload con limiti di
dimensione e validazione del contenuto reale, sanificazione degli SVG caricati come loghi,
cleanup dei file orfani su delete/replace, thumbnail generati per tavole/copertine.

Non ancora fatto / possibili prossimi passi: gestione capitoli/raggruppamento pagine (lo
schema Page ha solo `order` piatto, non capitoli), i18n (tutto è in italiano hardcoded),
statistiche di lettura (aggregate, lato admin — diverso dal progresso di lettura
per-visitatore già fatto), commenti/community.

## Comandi utili

```bash
npx prisma generate && npx prisma db push   # dopo modifiche a schema.prisma
npm run db:seed                             # ricrea/aggiorna l'utente admin da .env
npm run build                               # verifica TypeScript + route statiche/dinamiche
docker compose up -d --build                # deploy sul server Ubuntu
```
