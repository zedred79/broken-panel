# Broken Panel

Piattaforma di pubblicazione fumetti generati con l'AI a partire da classici della letteratura.
Stack: Next.js 16 (App Router) + Prisma/SQLite + NextAuth v5, tema scuro, reader con
effetto "zoom sulle vignette" stile GlobalComix.

## Sviluppo locale

Richiede Node.js 24 e npm. Prima del primo avvio, crea `.env`:

```bash
cp .env.example .env
```

Imposta `NEXTAUTH_URL=http://localhost:3000`, genera `NEXTAUTH_SECRET` con
`openssl rand -base64 32` e scegli `ADMIN_EMAIL` e `ADMIN_PASSWORD` (almeno 8
caratteri). Il template contiene `DATABASE_URL=file:./prisma/dev.db` per SQLite
locale; Docker Compose imposta un percorso separato dentro il container.

Installa e inizializza il progetto:

```bash
npm ci
npx prisma generate
npx prisma db push
npm run db:seed   # crea l'utente admin da ADMIN_EMAIL/ADMIN_PASSWORD in .env
npm run dev
```

Apri `http://localhost:3000`, admin su `http://localhost:3000/admin`.

`.env` e il database locale non sono versionati. Per le verifiche automatiche:

```bash
npm test
npm run lint
npx tsc --noEmit --incremental false
npm run build
```

I test usano cartelle temporanee per gli upload, senza modificare il database
o i file caricati dell'app. La build scarica i font da Google Fonts e richiede
accesso alla rete.

## Password admin

**Uso normale**: una volta loggato, cambiala da `/admin/settings` — non serve mai
toccare `.env` né riavviare nulla.

**Se resti bloccato fuori** (password dimenticata, non c'è un flusso "password
dimenticata" via email in questa app), c'è un reset forzato che reimposta la password a
quella scritta in `ADMIN_EMAIL`/`ADMIN_PASSWORD`:

- **In locale**:
  ```bash
  npm run db:reset-admin-password
  ```
- **In produzione** (il container non ha `npm` accessibile da fuori, va lanciato dentro
  con `docker exec`; `broken-panel` è il `container_name` in `docker-compose.yml`):
  ```bash
  docker exec broken-panel npx tsx prisma/reset-admin-password.ts
  ```
  Modifica prima `ADMIN_PASSWORD` in `.env` sul server se vuoi reimpostarla a un valore
  diverso da quello attuale, poi ricrea il container perché legga la modifica
  (`docker compose up -d`) prima di lanciare il reset — altrimenti reimposta alla
  password già in uso, il che non serve a molto.

Questo comando è pensato per essere lanciato **a mano, apposta**, non automaticamente:
`npm run db:seed` (che gira da solo ad ogni avvio del container) non tocca mai la
password di un admin già esistente, proprio per non cancellare un cambio fatto da UI a
ogni riavvio o aggiornamento immagine.

## Come funziona il reader

1. In admin carichi la tavola A4 di una pagina (PNG/JPEG/WebP).
2. Nell'editor "Ritaglia vignette" disegni un poligono libero attorno a ogni vignetta,
   nell'ordine di lettura (clic per aggiungere punti, doppio clic o clic sul primo punto
   per chiudere). Puoi riordinare, eliminare, o trascinare i vertici di una vignetta selezionata.
3. Il reader pubblico (`/read/[slug]`) mostra prima la pagina intera, poi zooma in sequenza
   su ogni vignetta scurendo il resto della tavola con una maschera SVG, con transizioni fluide.
   Navigazione con clic (sinistra/destra dello schermo), frecce ← →, barra spaziatrice.

## Test locale della build Docker

Prima di pubblicare una nuova versione su Docker Hub, conviene provare davvero
l'immagine di produzione in locale — cattura errori che il dev server (`npm run dev`,
modalità sviluppo) non mostra (è già successo con un `NEXTAUTH_SECRET` mancante e un
flag CLI non più supportato da Prisma 7). `docker-compose.local.yml` fa questo senza
bisogno di un `.env` o di ricordare a memoria un comando `docker run` lungo.

**La prima volta**, come in produzione, la cartella dati deve appartenere all'utente del
container (uid 1001) *prima* di avviarlo — altrimenti Docker la crea da sola come root e
l'app non riesce a scriverci:

```bash
mkdir -p data-local/db data-local/uploads
sudo chown -R 1001:1001 data-local
```

Poi:

```bash
docker compose -f docker-compose.local.yml up -d --build
```

Apri `http://localhost:8080/admin` — login `admin@test.local` / `testpassword123`
(credenziali fittizie valide solo qui, mai da usare in produzione). Per i log e per
fermarlo:

```bash
docker compose -f docker-compose.local.yml logs -f
docker compose -f docker-compose.local.yml down
```

I dati (DB, upload) restano in `./data-local` tra un riavvio e l'altro — cancella quella
cartella (e ripeti il `mkdir`/`chown` sopra) se vuoi ripartire da zero.

Rilancia sempre con `--build` dopo aver cambiato codice: senza, `docker compose` può
riusare l'immagine già costruita in precedenza invece di ricompilare (è il motivo esatto
per cui una volta il form "Cambia password" non compariva pur essendo già nel codice).

## Pubblicare l'immagine su Docker Hub

L'immagine è `zedred/broken-panel` (repository **privato**). Va ricostruita e
ripubblicata solo quando cambia il codice — il server di produzione non builda mai da
sorgente, scarica solo l'immagine già pronta (vedi sotto).

Da una macchina con i sorgenti aggiornati (dev machine, non necessariamente il server):

```bash
docker login   # una tantum, chiede le credenziali/token Docker Hub
docker compose build
docker compose push
```

**Prima del primo push**, crea il repository su hub.docker.com impostandolo su
**Private** — se non esiste ancora, un `docker push` lo creerebbe automaticamente ma
**pubblico** di default, e cambiarne la visibilità dopo è più scomodo che farlo bene
dall'inizio.

## Deploy in produzione con Docker + SWAG

Presuppone un server Ubuntu con SWAG (proxy reverse in Docker) già funzionante.
Il server non ha bisogno dei sorgenti del progetto: bastano `docker-compose.yml` e
`.env` (copiali dal repo, o creali a mano seguendo `.env.example`).

### 1. Configura le variabili

```bash
cp .env.example .env
# modifica .env: NEXTAUTH_SECRET (genera con `openssl rand -base64 32`),
# NEXTAUTH_URL, ADMIN_EMAIL, ADMIN_PASSWORD, SWAG_NETWORK_NAME
```

Per trovare il nome della rete Docker di SWAG:

```bash
docker network ls | grep -i swag
```

Se SWAG non è già su una rete Docker esterna dedicata, creane una e aggiungila anche
al `docker-compose.yml` di SWAG:

```bash
docker network create swag_default
```

### 2. Prepara le cartelle dati e avvia

Il database e gli upload vivono in `./data` (accanto a `docker-compose.yml`), mappata
dentro il container. Il container gira come utente non-root (uid **1001**): la cartella
deve appartenergli fin dall'inizio, altrimenti l'app non riesce a scriverci.

```bash
mkdir -p data/db data/uploads
sudo chown -R 1001:1001 data

docker login                 # se non l'hai già fatto su questa macchina
docker compose pull          # scarica zedred/broken-panel:latest, niente build locale
docker compose up -d
```

Il container:
- espone sull'host la porta definita da `HOST_PORT` in `.env` (default **48217**, scelta
  apposta non standard per non entrare in conflitto con gli altri servizi già sul server —
  cambiala liberamente se anche quella risulta occupata), quindi è già raggiungibile in LAN
  su `http://<ip-server>:48217` senza bisogno di SWAG;
- si collega anche alla rete `swag_net` (nome reale = `SWAG_NETWORK_NAME`), così SWAG
  può raggiungerlo internamente come `http://broken-panel:3000` (la porta **interna** al
  container resta sempre 3000, indipendentemente da `HOST_PORT`);
- al primo avvio sincronizza lo schema del database (`prisma db push`) e crea l'utente
  admin da `ADMIN_EMAIL`/`ADMIN_PASSWORD` (solo se non esiste già).

### 3. Esporre il sito su Internet via SWAG

Copia [`swag/broken-panel.subdomain.conf.sample`](swag/broken-panel.subdomain.conf.sample)
in `/config/nginx/proxy-confs/broken-panel.subdomain.conf` sul volume di configurazione
di SWAG (adatta `server_name` al tuo dominio/sottodominio), poi riavvia SWAG:

```bash
docker restart swag
```

### Dati persistenti

- `./data/db`: il database SQLite (`app.db`).
- `./data/uploads`: le immagini di pagine/copertine/loghi caricate.

Essendo cartelle normali sul filesystem dell'host (non volumi Docker nominati), il
backup è un `tar` diretto, senza bisogno di un container temporaneo:

```bash
tar czf broken-panel-backup-$(date +%F).tar.gz -C data .
```

### Aggiornare l'app

Dopo aver ripubblicato l'immagine (`docker compose build && docker compose push` dalla
dev machine, vedi sopra), sul server:

```bash
docker compose pull
docker compose up -d
```

`prisma db push` non cancella dati per modifiche non distruttive allo schema; per
modifiche più invasive valuta di passare a `prisma migrate` con file di migrazione
versionati.

Se preferisci ancora buildare direttamente sul server (serve avere i sorgenti lì e i
tool di compilazione nell'immagine, vedi PROJECT.md sul perché gli stage `deps`/`builder`
non usano `-slim`), `docker compose up -d --build` funziona esattamente come prima.
