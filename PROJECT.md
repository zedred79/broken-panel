# Broken Panel — contesto di progetto

Questo file esiste per permettere a chiunque (umano o AI) riprenda il progetto in una
sessione nuova di orientarsi rapidamente, senza dover rileggere tutto il codice da zero.
Il [README.md](README.md) spiega *come far girare* il progetto; questo file spiega
*perché è fatto così* e dove sono i punti delicati. Per l'elenco versionato di tutti i
componenti (Next.js, Prisma, immagine Docker base, ecc.) con eventuali aggiornamenti già
tentati e scartati, vedi [COMPONENTS.md](COMPONENTS.md).

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
- **docker-compose.local.yml**: variante solo per test locali della build Docker prima
  di pubblicare su Docker Hub — builda sempre dal codice corrente (mai `image:` da Docker
  Hub), nessuna rete SWAG richiesta, dati in `./data-local` (stessa insidia dei permessi
  uid 1001 di sopra). Vedi README per l'uso.

## Struttura del progetto

```
prisma.config.ts               Config Prisma 7 (datasource per i comandi CLI, vedi sopra)
prisma/schema.prisma           Modelli: User, Comic, Page, Panel, SiteSetting
prisma/seed.ts                 Crea l'admin da env SOLO se non esiste già (gira ad ogni
                                avvio del container, vedi sotto)
prisma/reset-admin-password.ts Reset forzato della password admin, solo manuale
                                (npm run db:reset-admin-password) — vedi sotto
prisma/admin-credentials.ts    ADMIN_EMAIL/ADMIN_PASSWORD lette dall'ambiente e
                                validate, condivise dai due script qui sopra

src/lib/
  auth.ts                      Config NextAuth (provider Credentials, callback JWT/session,
                                rate-limit sui tentativi di login, vedi sotto)
  login-rate-limit.ts          Contatori in-memory dei tentativi di login falliti
                                (per IP e per email, ruoli diversi — vedi sotto)
  prisma.ts                    Singleton PrismaClient (con adapter, vedi sopra)
  reading-progress.ts          Persistenza lato client (localStorage) dell'ultima pagina
                                letta di ogni fumetto — vedi sezione reader più sotto
  require-admin.ts             Helper per proteggere le API route
  site-config.ts               Testi homepage/footer configurabili da env
  slugify.ts, uploads.ts       Utility (slug univoci, salvataggio/validazione/sanificazione
                                immagini su disco, generazione thumbnail — vedi sotto)

src/proxy.ts                  Ex "middleware.ts" (rinominato in Next 16, vedi sotto).
                               Protegge /admin/* redirigendo a /login se non autenticati.

src/app/sitemap.ts             Sitemap XML generato dai fumetti pubblicati (dinamico)
src/app/robots.ts              robots.txt (dinamico, vedi sotto il perché)

src/app/(site)/                Sito pubblico: home, /comics/[slug]
src/app/admin/                 Area admin (dashboard, editor fumetto, editor vignette)
src/app/api/                   Route handler REST per comics/pages/panels/chapters
src/app/login/                 Login admin (server action + form)
src/app/read/[slug]/           Il reader immersivo (componente client ComicReader)

src/components/admin/          PanelEditor (slicer poligoni), PageManager, ChapterManager,
                                ComicForm, DeleteComicButton, AdminNav, SiteSettingsForm,
                                ChangePasswordForm
src/components/reader/         ComicReader (la logica di zoom/maschera)
src/components/site/           Navbar, Footer, ComicCard, ContinueReadingLink

src/generated/prisma/          Client Prisma generato — NON committato (vedi .gitignore),
                                rigenerato ad ogni `npx prisma generate` / build Docker.
```

## Modello dati (prisma/schema.prisma)

```
User    { email, passwordHash }                         — un solo record, l'admin
Comic   { slug, title, sourceWork, author, description,
          style, coverImage, coverThumbnail,
          status: draft|published }
Chapter { comicId, title, order }                        — etichetta di raggruppamento,
                                                             vedi sotto
Page    { comicId, order, chapterId?,                    — una tavola A4 caricata
          imageUrl, thumbnailUrl, width, height }
Panel   { pageId, order, points: JSON stringify di       — poligono libero di una vignetta,
          [{x,y}, ...] in percentuale 0-100 }               coordinate % relative all'immagine
SiteSetting { id: "singleton", headerLogo?, heroLogo? }  — riga unica, loghi personalizzati
```

`coverThumbnail`/`thumbnailUrl` (WebP 480px, generati all'upload — vedi sezione hardening
upload più sotto) e `Page.chapterId` sono nullable perché aggiunti con un `db push`
additivo: i fumetti/pagine caricati prima di queste modifiche continuano a funzionare — i
componenti che li usano fanno fallback all'originale (`thumbnailUrl ?? imageUrl`) o alla
condizione "senza capitolo" (`chapterId === null`), nessun backfill retroattivo è stato
fatto.

**Capitoli**: `Chapter` è puramente un'etichetta di navigazione, non un secondo asse di
ordinamento — l'ordine di lettura resta interamente `Page.order` (invariato). L'admin
assegna ogni pagina a un capitolo via dropdown in `PageManager`
(`PATCH /api/pages/[id]` con `{chapterId}`); `PageManager` e il picker pagine del reader
(`ComicReader.tsx`) raggruppano visivamente scorrendo l'array di pagine già ordinato e
inserendo un header ogni volta che il `chapterId`/titolo cambia — nessuna gestione
speciale se le pagine di un capitolo non sono contigue, compaiono semplicemente più
gruppi. Eliminare un capitolo (`DELETE /api/chapters/[id]`) sgancia le sue pagine
(`onDelete: SetNull`), non le cancella. Riordino capitoli via
`PATCH /api/chapters/[id] {direction}`, stesso pattern di swap con `order: -1`
temporaneo già usato per le pagine.

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
   **Alla prima pagina il progresso viene cancellato, non salvato**: prima
   veniva scritto anche al mount con `pageIndex = 0`, così bastava aprire un
   fumetto e uscire perché la scheda mostrasse "Continue from page 1" invece
   di "Read now". Cancellare (invece di limitarsi a non salvare) serve al caso
   in cui si torni indietro fino all'inizio dopo aver già letto avanti:
   altrimenti resterebbe salvato un progresso stantio.

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

Due dettagli non ovvi su questa route:

- Risponde con `X-Content-Type-Options: nosniff` e una CSP restrittiva
  (`default-src 'none'; style-src 'unsafe-inline'`) oltre al `Cache-Control`
  immutabile. La direttiva `sandbox` è volutamente esclusa: per spec vale solo
  per le risposte richieste come documento, ma è l'unica che — se un browser
  la interpretasse più aggressivamente — potrebbe impedire il rendering delle
  immagini dentro `<img>`, cioè rompere tutto il sito, e `default-src 'none'`
  copre già il caso che interessa. È l'unico endpoint del sito che restituisce
  contenuto caricato dall'utente, e tra i formati ammessi per i loghi c'è
  l'SVG: sono già sanificati all'upload (vedi sotto), ma se quella
  sanificazione dovesse un giorno lasciar passare qualcosa, questi header
  impediscono comunque l'esecuzione quando il file viene aperto direttamente.
- Ogni `path.join(UPLOADS_ROOT, ...)` (qui e in `src/lib/uploads.ts`) porta un
  commento `/*turbopackIgnore: true*/`. `UPLOADS_ROOT` dipende da una
  variabile d'ambiente, quindi Turbopack non riesce ad analizzarlo
  staticamente e in build tracciava e includeva **l'intero progetto**
  (sorgenti e `public/` compresi) nell'output server, con tanto di warning.
  Il commento gli dice di non provare a risolvere quel path: quei file li
  leggiamo e scriviamo a runtime, non c'è niente da bundlare. **Se aggiungi
  altri accessi al filesystem su `UPLOADS_ROOT`, mettici lo stesso commento**,
  altrimenti il warning (e il tracing di tutto il progetto) ritorna.

## Hardening di sicurezza (upload e login)

Tutto qui sotto è stato aggiunto dopo un audit di sicurezza del codice iniziale, che
accettava upload senza limiti né validazione del contenuto reale e non aveva alcun
rate-limit sui tentativi di login.

- **Limiti di dimensione** per tipo di upload: 20MB tavole (spesso render AI ad alta
  risoluzione), 8MB copertine, 2MB loghi (icone piccole). Controllati su `file.size`
  prima di leggere il buffer in memoria.
- **Validazione sul contenuto reale, non sul Content-Type dichiarato dal client**: per i
  formati raster (PNG/JPEG/WebP), `validateRasterImage()` verifica in due passaggi che il
  file sia davvero del formato che dichiara — un file rinominato con estensione/MIME
  falsi viene rifiutato con 400 invece di essere salvato as-is.
  1. **Pre-check sui magic byte** (`RASTER_MAGIC_BYTES`): confronta a mano la firma del
     file con quella attesa per il MIME dichiarato, **prima** di passare il buffer a
     `image-size`. Non è ridondante rispetto al passo 2: `image-size` riconosce il
     formato provando i parser di *tutti* i formati che supporta, quindi senza questo
     pre-check un file ICNS/JXL/HEIF dichiarato `image/png` verrebbe comunque dato in
     pasto al parser di quel formato — e quei parser hanno vulnerabilità note di loop
     infinito senza fix a monte (vedi [COMPONENTS.md](COMPONENTS.md)). Siccome
     `imageSize()` è sincrona, un loop bloccherebbe l'event loop di Node, cioè l'intero
     sito (pagine pubbliche comprese) fino a un riavvio manuale del container: il
     `restart: unless-stopped` di Compose non interverrebbe, perché il processo resterebbe
     appeso, non crashato. **Se aggiungi un formato raster ad `ALLOWED_TYPES`, aggiungi
     anche la sua firma a `RASTER_MAGIC_BYTES`**, altrimenti l'upload verrà rifiutato.
  2. `image-size` legge il formato dai byte reali e si verifica che corrisponda al MIME
     dichiarato — difesa in profondità, oltre a fornire le dimensioni dell'immagine.
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

  Vale anche per il percorso meno ovvio, cioè il **fallimento della scrittura su
  DB dopo che il file è già finito su disco**: `POST /api/comics` e
  `POST /api/comics/[id]/pages` salvano immagine e thumbnail *prima* della
  `create` di Prisma, quindi un errore lì (DB lockato, disco pieno, slug
  diventato duplicato per una richiesta concorrente) lascerebbe file che nessuna
  riga referenzia. Entrambe avvolgono ora la `create` in un try/catch che li
  cancella e rilancia — stesso pattern già presente nel PATCH di
  `/api/comics/[id]`. **Se aggiungi altre route che scrivono un upload prima di
  toccare il DB, ripeti questo schema.**
- **Header di sicurezza sulla route che serve gli upload**
  (`nosniff` + CSP restrittiva, vedi la sezione precedente): difesa in
  profondità in caso la sanificazione SVG lasci passare qualcosa.
- **Header di sicurezza globali** (`next.config.ts`, funzione `headers()`):
  `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` che
  nega camera/microfono/geolocalizzazione, più `poweredByHeader: false`. Prima
  esistevano header solo sulla route degli upload: `/admin` e `/login` — cioè le
  pagine con le azioni distruttive — erano incorniciabili in un iframe di terze
  parti (clickjacking). Verificato con `curl -D-` sul server di produzione: gli
  header compaiono su pagine, redirect del proxy e route API, e **non**
  sovrascrivono la CSP più stretta della route upload, che resta la sua.

  Deliberatamente **senza una CSP globale**: Next.js inietta script inline per
  idratazione e router, quindi servirebbero nonce per-richiesta generati nel
  proxy — sproporzionato e facile da sbagliare in modo che rompa il sito solo in
  produzione. `frame-ancestors`, l'unica direttiva che servirebbe davvero, è già
  coperta da `X-Frame-Options: DENY`.
- **Rate-limit sul login** (`src/lib/login-rate-limit.ts`, usato in
  `src/lib/auth.ts` e in `POST /api/account/password`). In-memory (si resetta a
  un riavvio del container) — scelta proporzionata a un'app a singolo processo
  con un solo account admin, non serve infrastruttura esterna. **Due contatori
  con ruoli diversi**, ed è il punto centrale del file:
  - **per IP**: blocco vero e proprio, 10 fallimenti / 15 minuti. È qui che sta
    la difesa anti-bruteforce.
  - **per email**: mai un blocco, solo un ritardo progressivo (500ms → 4s max)
    applicato *prima* di rispondere, sia in caso di successo che di fallimento
    (se scattasse solo sui fallimenti sarebbe a sua volta un oracolo sulla
    correttezza della password). Serve a rendere costoso un bruteforce
    distribuito su tanti IP, che sfuggirebbe al blocco per IP.

  **Insidia trovata e corretta** (2026-09-05): all'inizio la chiave era *solo*
  l'email, e il blocco veniva valutato prima ancora di verificare la password.
  Chiunque indovinasse l'indirizzo dell'admin poteva impedirgli di entrare
  — anche con la password giusta — mandando 5 password sbagliate ogni 15 minuti:
  un DoS gratuito sull'unico account del sito. Ora una password corretta passa
  sempre, purché non arrivi da un IP già bloccato.

  **Seconda insidia, stessa occasione**: al superamento di `MAX_TRACKED_KEYS`
  (10.000) il file faceva `attempts.clear()`, svuotando *tutta* la Map. Bastavano
  10.000 richieste con email casuali per cancellare anche il contatore
  dell'account sotto attacco e ripartire da zero. Ora l'eviction è incrementale
  (prima le entry scadute, poi le più vecchie) e le due Map sono separate proprio
  per questo: un flood di email finte fa crescere solo `emailAttempts`, mentre in
  `ipAttempts` resta una sola entry — l'IP dell'attaccante. Il blocco che conta
  non può più evaporare.

  **Limite noto (accettato)**: la chiave IP viene dall'ultimo elemento di
  `X-Forwarded-For` — quello che nginx/SWAG appende con
  `$proxy_add_x_forwarded_for`, l'unico che il client non può falsificare
  *passando dal proxy*. Ma `docker-compose.yml` pubblica la porta anche
  sull'host (serve l'accesso in LAN, scelta deliberata), e chi la raggiunge
  direttamente può inventarsi l'header e ottenere un bucket diverso ad ogni
  tentativo. Resta comunque attivo il ritardo per email, che non dipende
  dall'IP. Chiudere il buco richiederebbe di fidarsi dell'header solo in
  presenza di un segreto condiviso col proxy — sproporzionato finché la porta
  non è esposta su internet.
- **Tempo di risposta costante al login**, contro l'enumerazione degli account:
  se l'email non esiste, `authorize()` confronta comunque la password contro un
  hash "civetta" generato da byte casuali. Prima il ramo "utente inesistente"
  tornava in <1ms mentre quello "utente esistente, password sbagliata" pagava i
  ~200ms di bcrypt: bastava cronometrare le risposte per sapere quale email
  corrisponde a un account reale.
- **Rate-limit anche su `POST /api/account/password`**, sullo stesso contatore
  per IP del login (è lo stesso attaccante e la stessa credenziale, non ha senso
  tenerli separati). Serve al caso in cui una sessione admin sia stata dirottata:
  senza, chi la controlla potrebbe provare `currentPassword` all'infinito, e
  indovinarla gli permetterebbe di cambiare la password e scacciare l'admin.
- **Nessuna credenziale di default negli script di seed**
  (`prisma/admin-credentials.ts`): `ADMIN_EMAIL` e `ADMIN_PASSWORD` sono
  obbligatorie e la password deve rispettare lo stesso minimo di 8 caratteri
  imposto dal cambio password da UI. Prima gli script ricadevano su
  `admin@brokenpanel.local` / `changeme123`, scritte in chiaro nel sorgente: in
  Docker non poteva succedere (`docker-entrypoint.sh` esegue il seed solo se
  entrambe le variabili sono valorizzate), ma un `npm run db:seed` locale senza
  `.env` bastava a creare un account con credenziali note pubblicamente.

## Route API principali

- `POST /api/comics`, `GET/PATCH/DELETE /api/comics/[id]` — CRUD fumetto (multipart
  form-data, gestisce anche l'upload della copertina)
- `POST /api/comics/[id]/pages` — upload di una tavola (multipart, legge le dimensioni
  reali dell'immagine con la libreria `image-size`)
- `PATCH /api/pages/[id]` (`{direction: "up"|"down"}` per riordinare, oppure
  `{chapterId: string|null}` per assegnare/rimuovere il capitolo), `DELETE /api/pages/[id]`
- `GET/PUT /api/pages/[id]/panels` — legge/sostituisce l'elenco vignette di una pagina
- `POST /api/comics/[id]/chapters` — crea un capitolo
- `PATCH /api/chapters/[id]` (`{direction}` per riordinare, `{title}` per rinominare),
  `DELETE /api/chapters/[id]`
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
controllato ad ogni richiesta — non implementata, sproporzionata per questo caso
d'uso, e con una controindicazione concreta: il callback `jwt` gira anche in
`src/proxy.ts`, quindi una query Prisma lì dentro trascinerebbe `better-sqlite3`
(modulo nativo) in un contesto dove oggi non serve.

Mitigazione economica applicata al suo posto: `session.maxAge` esplicito a **7
giorni** invece del default di Auth.js (30). Non revoca niente, ma accorcia di
oltre quattro volte la finestra in cui una sessione clonata resta valida.

**Insidia trovata e corretta** (scattata subito, testando in locale con Docker): prima
`prisma/seed.ts` faceva un `upsert` che aggiornava sempre `passwordHash` da
`ADMIN_PASSWORD`. Siccome `docker-entrypoint.sh` esegue il seed **ad ogni avvio del
container**, non solo la prima volta, un riavvio o un aggiornamento immagine (`docker
compose pull && up -d`) avrebbe silenziosamente cancellato qualsiasi password cambiata
da UI, riportandola a quella in `.env`. Ora `seed.ts` crea l'admin solo se non esiste
già, senza mai toccare la password di un utente esistente. Per un reset forzato
volontario (es. password dimenticata, non c'è un flusso "password dimenticata" via
email) resta `prisma/reset-admin-password.ts` (`npm run db:reset-admin-password`,
oppure `docker exec <container> npx tsx prisma/reset-admin-password.ts` in produzione)
— stesso comportamento upsert di prima, ma eseguito solo a mano, apposta, non più
automaticamente ad ogni boot.

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

## SEO e anteprime social (metadata)

Prima esisteva solo il `metadata` statico del layout radice, quindi *ogni*
pagina — homepage, ogni scheda fumetto, ogni pagina del reader — dichiarava lo
stesso titolo e la stessa descrizione. Conseguenze pratiche: nei risultati di
ricerca i fumetti erano indistinguibili tra loro, e incollare il link di un
fumetto in una chat non mostrava né titolo né copertina (mancavano i tag
OpenGraph), pur avendo la copertina già nel DB.

Come è organizzato ora:

- `src/app/layout.tsx` definisce `metadataBase` (serve a Next per rendere
  assoluti gli URL relativi: le copertine sono path tipo `/uploads/xxx.png`, e
  le anteprime social richiedono URL assoluti) e un `title.template`
  (`"%s — Broken Panel"`), così le pagine figlie impostano solo il proprio
  titolo.
- `generateMetadata()` in `src/app/(site)/comics/[slug]/page.tsx` produce
  titolo, descrizione (quella del fumetto, con un fallback costruito da
  `sourceWork`/`author`/`style` se manca), canonical, OpenGraph e Twitter Card
  con la copertina **a piena risoluzione** (non il thumbnail da 480px: le
  piattaforme riscalano da sole e una sorgente piccola verrebbe sgranata).
  Ripete la stessa condizione `status !== "published"` del componente: senza,
  una bozza esporrebbe titolo e trama nei metadata di una pagina che poi
  risponde 404.
- `generateMetadata()` in `src/app/read/[slug]/page.tsx` dà un titolo proprio
  al reader e soprattutto `robots: { index: false, follow: true }` — il reader
  è un'app client, per un crawler è una pagina vuota, e indicizzarla
  significherebbe farla competere con la scheda del fumetto.
- `src/app/sitemap.ts` elenca homepage + fumetti pubblicati con `lastModified`.
- `src/app/robots.ts` blocca `/admin/`, `/api/`, `/login`, `/read/` e dichiara
  il sitemap.

**Insidia (la stessa già nota, ma con due cause diverse)**: entrambe le route
esportano `export const dynamic = "force-dynamic"`. Per il **sitemap** il
motivo è quello classico — legge dal DB con una query Prisma diretta, quindi
senza quell'export verrebbe congelato al build e un fumetto pubblicato dopo non
comparirebbe mai. Per **robots.ts** invece la causa è un'altra: non legge dal
DB ma legge `SITE_URL` da una variabile d'ambiente, e l'immagine Docker viene
buildata *senza* le env di produzione — da statica, il sitemap dichiarato lì
punterebbe a `localhost`. Verifica con `npm run build`: `/sitemap.xml` e
`/robots.txt` devono comparire come `ƒ`, non `○`.

Le piattaforme social cachano le anteprime in modo aggressivo: conviene
controllare che i tag siano corretti *prima* di condividere in giro i link, non
dopo.

## Variabili d'ambiente (vedi .env.example)

`DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`,
`HOST_PORT`, `SWAG_NETWORK_NAME`, `SITE_URL` (opzionale: URL pubblico usato per
i metadata SEO/social — se non impostata si usa `NEXTAUTH_URL`, che è già
"l'URL pubblico del sito", per non avere due variabili da tenere allineate),
e i testi homepage/footer configurabili
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
cleanup dei file orfani su delete/replace, thumbnail generati per tavole/copertine,
capitoli come etichetta di raggruppamento sopra l'ordine di lettura piatto (gestione da
`ChapterManager` in admin, raggruppamento nel picker pagine del reader — vedi sopra),
metadata SEO/OpenGraph per fumetto + sitemap e robots.txt dinamici (vedi sopra).

Non ancora fatto / possibili prossimi passi: riordino drag&drop delle pagine
per-capitolo (oggi l'ordine resta globale sul fumetto, senza enforcement di contiguità
tra pagine dello stesso capitolo), i18n (tutto è in italiano hardcoded), statistiche di
lettura (aggregate, lato admin — diverso dal progresso di lettura per-visitatore già
fatto), commenti/community, test automatizzati (nessuno presente, verifica solo tramite
`npm run build`/lint + test manuale).

## Comandi utili

```bash
npx prisma generate && npx prisma db push   # dopo modifiche a schema.prisma
npm run db:seed                             # ricrea/aggiorna l'utente admin da .env
npm run build                               # verifica TypeScript + route statiche/dinamiche
docker compose up -d --build                # deploy sul server Ubuntu
```
