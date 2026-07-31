# Broken Panel

Piattaforma di pubblicazione fumetti generati con l'AI a partire da classici della letteratura.
Stack: Next.js 16 (App Router) + Prisma/SQLite + NextAuth v5, tema scuro, reader con
effetto "zoom sulle vignette" stile GlobalComix.

## Sviluppo locale

```bash
npm install
npx prisma generate
npx prisma db push
npm run db:seed   # crea l'utente admin da ADMIN_EMAIL/ADMIN_PASSWORD in .env
npm run dev
```

Apri `http://localhost:3000`, admin su `http://localhost:3000/admin`.

Le variabili di sviluppo sono in `.env` (già presente, con credenziali di test:
`admin@brokenpanel.local` / `changeme123` — **cambiale prima di andare in produzione**).

## Come funziona il reader

1. In admin carichi la tavola A4 di una pagina (PNG/JPEG/WebP).
2. Nell'editor "Ritaglia vignette" disegni un poligono libero attorno a ogni vignetta,
   nell'ordine di lettura (clic per aggiungere punti, doppio clic o clic sul primo punto
   per chiudere). Puoi riordinare, eliminare, o trascinare i vertici di una vignetta selezionata.
3. Il reader pubblico (`/read/[slug]`) mostra prima la pagina intera, poi zooma in sequenza
   su ogni vignetta scurendo il resto della tavola con una maschera SVG, con transizioni fluide.
   Navigazione con clic (sinistra/destra dello schermo), frecce ← →, barra spaziatrice.

## Deploy in produzione con Docker + SWAG

Presuppone un server Ubuntu con SWAG (proxy reverse in Docker) già funzionante.

### 1. Copia il progetto sul server e configura le variabili

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

### 2. Build e avvio

```bash
docker compose up -d --build
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

- `broken_panel_db` (volume Docker): il database SQLite.
- `broken_panel_uploads` (volume Docker): le immagini delle pagine/copertine caricate.

Per backup rapidi:

```bash
docker run --rm -v broken-panel_broken_panel_db:/data -v "$PWD":/backup \
  alpine tar czf /backup/broken-panel-db-backup.tar.gz -C /data .
```

### Aggiornare l'app

```bash
git pull   # se versionato
docker compose up -d --build
```

`prisma db push` non cancella dati per modifiche non distruttive allo schema; per
modifiche più invasive valuta di passare a `prisma migrate` con file di migrazione
versionati.
