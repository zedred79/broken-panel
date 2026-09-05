// Credenziali dell'admin lette dall'ambiente, condivise fra seed.ts e
// reset-admin-password.ts (che le usano in modi diversi ma le validano allo
// stesso modo).
//
// Nessun fallback su credenziali di default: prima ogni script ricadeva su
// "admin@brokenpanel.local" / "changeme123", scritte in chiaro nel sorgente. In
// Docker non poteva succedere (docker-entrypoint.sh esegue il seed solo se
// entrambe le variabili sono valorizzate), ma un `npm run db:seed` locale senza
// .env bastava a creare un account con credenziali note pubblicamente.

// Stesso minimo imposto dal cambio password da UI
// (src/app/api/account/password/route.ts).
const MIN_PASSWORD_LENGTH = 8;

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} non impostata (vedi .env.example)`);
  }
  return value;
}

export const ADMIN_EMAIL = requiredEnv("ADMIN_EMAIL");
export const ADMIN_PASSWORD = requiredEnv("ADMIN_PASSWORD");

if (ADMIN_PASSWORD.length < MIN_PASSWORD_LENGTH) {
  throw new Error(
    `ADMIN_PASSWORD deve essere di almeno ${MIN_PASSWORD_LENGTH} caratteri`
  );
}
