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
  immagini ufficiali attivamente mantenuto). + **docker-compose.yml** con porta host non
  standard (`HOST_PORT`, default 48217, per non entrare in conflitto con gli altri servizi
  già sul server) e rete esterna condivisa con SWAG.

## Struttura del progetto

```
prisma/schema.prisma          Modelli: User, Comic, Page, Panel
prisma/seed.ts                Crea/aggiorna l'utente admin da env

src/lib/
  auth.ts                     Config NextAuth (provider Credentials, callback JWT/session)
  prisma.ts                   Singleton PrismaClient
  require-admin.ts            Helper per proteggere le API route
  site-config.ts              Testi homepage/footer configurabili da env
  slugify.ts, uploads.ts      Utility (slug univoci, salvataggio immagini su disco)

src/proxy.ts                  Ex "middleware.ts" (rinominato in Next 16, vedi sotto).
                               Protegge /admin/* redirigendo a /login se non autenticati.

src/app/(site)/                Sito pubblico: home, /comics/[slug]
src/app/admin/                 Area admin (dashboard, editor fumetto, editor vignette)
src/app/api/                   Route handler REST per comics/pages/panels
src/app/login/                 Login admin (server action + form)
src/app/read/[slug]/           Il reader immersivo (componente client ComicReader)

src/components/admin/          PanelEditor (slicer poligoni), PageManager, ComicForm,
                                DeleteComicButton, AdminNav, SiteSettingsForm
src/components/reader/         ComicReader (la logica di zoom/maschera)
src/components/site/           Navbar, Footer, ComicCard

src/generated/prisma/          Client Prisma generato — NON committato (vedi .gitignore),
                                rigenerato ad ogni `npx prisma generate` / build Docker.
```

## Modello dati (prisma/schema.prisma)

```
User   { email, passwordHash }                         — un solo record, l'admin
Comic  { slug, title, sourceWork, author, description,
         style, coverImage, status: draft|published }
Page   { comicId, order, imageUrl, width, height }      — una tavola A4 caricata
Panel  { pageId, order, points: JSON stringify di       — poligono libero di una vignetta,
         [{x,y}, ...] in percentuale 0-100 }              coordinate % relative all'immagine
SiteSetting { id: "singleton", headerLogo?, heroLogo? } — riga unica, loghi personalizzati
```

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
   (`pickerOpen`) con una griglia di miniature di tutte le pagine (riusa gli `imageUrl`
   già presenti nei dati passati al componente, nessuna chiamata aggiuntiva). Cliccando
   una miniatura si chiama `jumpToPage(index)`: imposta `pageIndex` e resetta
   `panelIndex = -1` (arrivo a pagina intera, come da flusso normale). Serve a non dover
   rifare tutte le vignette delle pagine già lette per riprendere più avanti. Chiusura
   con ✕, click fuori dalla griglia, o Esc; mentre il picker è aperto le frecce ← → e lo
   spazio non navigano (guardia `if (pickerOpen) return;` nell'handler keydown).

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

## Route API principali

- `POST /api/comics`, `GET/PATCH/DELETE /api/comics/[id]` — CRUD fumetto (multipart
  form-data, gestisce anche l'upload della copertina)
- `POST /api/comics/[id]/pages` — upload di una tavola (multipart, legge le dimensioni
  reali dell'immagine con la libreria `image-size`)
- `PATCH /api/pages/[id]` (`{direction: "up"|"down"}`), `DELETE /api/pages/[id]`
- `GET/PUT /api/pages/[id]/panels` — legge/sostituisce l'elenco vignette di una pagina
- `GET/PUT /api/site-settings` — loghi personalizzati (vedi sotto)

Tutte protette da `requireAdmin()` (controllo sessione NextAuth lato server).

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

Fatto: sito pubblico, reader con zoom e salto rapido a una pagina specifica, area admin
completa (CRUD fumetti, upload pagine, editor vignette, eliminazione fumetti), auth,
Docker + config SWAG di esempio, testi homepage configurabili da env, loghi header/hero
personalizzabili da `/admin/settings`.

Non ancora fatto / possibili prossimi passi: cambio password admin da UI (va ancora
rifatto il seed/riavviato il container), gestione capitoli/raggruppamento pagine (lo
schema Page ha solo `order` piatto, non capitoli), i18n (tutto è in italiano hardcoded),
statistiche di lettura, commenti/community, ricordare automaticamente l'ultima pagina
letta tra una sessione e l'altra (oggi il salto pagina è manuale, non c'è persistenza
del progresso di lettura).

## Comandi utili

```bash
npx prisma generate && npx prisma db push   # dopo modifiche a schema.prisma
npm run db:seed                             # ricrea/aggiorna l'utente admin da .env
npm run build                               # verifica TypeScript + route statiche/dinamiche
docker compose up -d --build                # deploy sul server Ubuntu
```
