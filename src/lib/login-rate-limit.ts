const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

// Limite di sicurezza sulla memoria: se qualcuno bombarda il login con email
// finte diverse per far crescere la Map indefinitamente, la svuotiamo invece
// di continuare ad accumulare — si perde solo lo stato di rate-limit
// accumulato finora, non un problema per un'app a singolo admin.
const MAX_TRACKED_KEYS = 10_000;

type Attempt = { count: number; firstAttemptAt: number };

// In-memory: adatto a un'app a singolo processo/container con un solo
// account admin (vedi PROJECT.md). Si resetta a un riavvio del container, ma
// rallenta comunque un bruteforce online sull'unico account esistente senza
// bisogno di infrastruttura esterna (Redis, tabella DB dedicata, ecc.). Non
// funzionerebbe se l'app girasse su più repliche dietro un load balancer.
const attempts = new Map<string, Attempt>();

function isExpired(entry: Attempt): boolean {
  return Date.now() - entry.firstAttemptAt > WINDOW_MS;
}

export function isLoginRateLimited(key: string): boolean {
  const entry = attempts.get(key);
  if (!entry || isExpired(entry)) return false;
  return entry.count >= MAX_ATTEMPTS;
}

export function registerFailedLogin(key: string): void {
  const entry = attempts.get(key);
  if (!entry || isExpired(entry)) {
    if (attempts.size >= MAX_TRACKED_KEYS) attempts.clear();
    attempts.set(key, { count: 1, firstAttemptAt: Date.now() });
    return;
  }
  entry.count += 1;
}

export function clearLoginAttempts(key: string): void {
  attempts.delete(key);
}
