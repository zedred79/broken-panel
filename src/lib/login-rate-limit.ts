// Rate-limit dei tentativi di login. In-memory: adatto a un'app a singolo
// processo/container con un solo account admin (vedi PROJECT.md). Si resetta a
// un riavvio del container, ma rallenta comunque un bruteforce online senza
// bisogno di infrastruttura esterna (Redis, tabella DB dedicata, ecc.). Non
// funzionerebbe se l'app girasse su più repliche dietro un load balancer.
//
// Due contatori separati, con ruoli diversi — la distinzione è il punto
// centrale di questo file:
//
//  - per IP: blocco vero e proprio. È qui che sta la difesa anti-bruteforce.
//  - per email: MAI un blocco, solo un ritardo progressivo. Prima l'email era
//    l'unica chiave e bastavano 5 password sbagliate ogni 15 minuti per
//    impedire all'admin legittimo di entrare *anche con la password giusta* —
//    un DoS gratuito per chiunque ne indovinasse l'indirizzo. Ora una password
//    corretta passa sempre, purché non arrivi da un IP già bloccato.
//
// Le due Map sono separate anche per un motivo di capacity: chi inonda il login
// con email finte diverse fa crescere solo `emailAttempts` (una entry per
// email), mentre in `ipAttempts` resta una sola entry — il suo IP. Così lo
// svuotamento per pressione di memoria non può mai far evaporare il blocco che
// conta.

const WINDOW_MS = 15 * 60 * 1000;

// Blocco duro per IP. Più alto del vecchio limite per email (5) perché un IP
// legittimo può ospitare più tentativi maldestri dello stesso admin.
const MAX_IP_ATTEMPTS = 10;

// Soglia oltre la quale i tentativi sulla stessa email iniziano a pagare un
// ritardo. Non blocca: rallenta e basta.
const EMAIL_SOFT_LIMIT = 5;
const BASE_DELAY_MS = 500;
const MAX_DELAY_MS = 4000;

// Tetto al numero di chiavi tracciate, per non far crescere le Map
// indefinitamente sotto attacco.
const MAX_TRACKED_KEYS = 10_000;

type Attempt = { count: number; firstAttemptAt: number };

const ipAttempts = new Map<string, Attempt>();
const emailAttempts = new Map<string, Attempt>();

function isExpired(entry: Attempt): boolean {
  return Date.now() - entry.firstAttemptAt > WINDOW_MS;
}

// Eviction incrementale al posto del vecchio `attempts.clear()`, che svuotava
// *tutta* la Map: bastavano 10.000 richieste con email casuali per cancellare
// anche il contatore dell'account sotto attacco e ripartire da zero. Qui si
// buttano prima le entry scadute (che non servono più a nessuno) e solo se non
// bastano si scartano le più vecchie — Map itera in ordine di inserimento,
// quindi il primo elemento è sempre il meno recente.
function evictIfFull(map: Map<string, Attempt>): void {
  if (map.size < MAX_TRACKED_KEYS) return;

  for (const [key, entry] of map) {
    if (isExpired(entry)) map.delete(key);
  }

  while (map.size >= MAX_TRACKED_KEYS) {
    const oldest = map.keys().next();
    if (oldest.done) break;
    map.delete(oldest.value);
  }
}

function register(map: Map<string, Attempt>, key: string): void {
  const entry = map.get(key);
  if (!entry || isExpired(entry)) {
    evictIfFull(map);
    map.set(key, { count: 1, firstAttemptAt: Date.now() });
    return;
  }
  entry.count += 1;
}

/** Blocco duro: l'IP ha superato il numero di fallimenti nella finestra. */
export function isLoginRateLimited(ipKey: string): boolean {
  const entry = ipAttempts.get(ipKey);
  if (!entry || isExpired(entry)) return false;
  return entry.count >= MAX_IP_ATTEMPTS;
}

/**
 * Ritardo (ms) da attendere prima di rispondere, in base ai fallimenti recenti
 * su questa email. 0 finché si resta sotto la soglia, poi cresce
 * esponenzialmente fino a `MAX_DELAY_MS`. Non impedisce mai il login: serve
 * solo a rendere costoso un bruteforce distribuito su tanti IP, che sfuggirebbe
 * al blocco per IP.
 */
export function loginThrottleDelayMs(emailKey: string): number {
  const entry = emailAttempts.get(emailKey);
  if (!entry || isExpired(entry)) return 0;
  if (entry.count < EMAIL_SOFT_LIMIT) return 0;
  const excess = entry.count - EMAIL_SOFT_LIMIT + 1;
  return Math.min(BASE_DELAY_MS * 2 ** (excess - 1), MAX_DELAY_MS);
}

export function registerFailedLogin(ipKey: string, emailKey: string): void {
  register(ipAttempts, ipKey);
  register(emailAttempts, emailKey);
}

export function clearLoginAttempts(ipKey: string, emailKey: string): void {
  ipAttempts.delete(ipKey);
  emailAttempts.delete(emailKey);
}

/**
 * Chiave di rate-limit per IP. In produzione le richieste arrivano da SWAG, che
 * usa `$proxy_add_x_forwarded_for`: appende il peer reale *in coda* a quello che
 * il client ha eventualmente dichiarato, quindi l'ultimo elemento della lista è
 * l'unico che il client non può falsificare.
 *
 * Limite noto: `docker-compose.yml` pubblica la porta anche sull'host (serve
 * l'accesso in LAN), e chi la raggiunge senza passare da SWAG può mandare un
 * `X-Forwarded-For` inventato, ottenendo un bucket diverso ad ogni tentativo e
 * aggirando il blocco per IP. Resta comunque attivo il ritardo progressivo per
 * email, che non dipende dall'IP. Chiudere davvero il buco richiederebbe di
 * fidarsi dell'header solo in presenza di un segreto condiviso col proxy —
 * sproporzionato finché la porta non è esposta su internet.
 */
export function clientIpKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded.split(",");
    const last = parts[parts.length - 1]?.trim();
    if (last) return last;
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  return realIp || "unknown";
}
