import type { NextConfig } from "next";

// Header di sicurezza applicati a tutto il sito. Prima esistevano solo sulla
// route che serve gli upload (src/app/uploads/[filename]/route.ts, che ne ha di
// suoi più stretti): /admin e /login, cioè le pagine con azioni distruttive,
// non ne avevano nessuno ed erano inseribili in un iframe di terze parti.
//
// Deliberatamente SENZA una Content-Security-Policy globale: Next.js inietta
// script inline per l'idratazione e il router, quindi una CSP sensata qui
// richiederebbe nonce per-richiesta generati nel proxy — sproporzionato, e
// facile da sbagliare in modo che rompa il sito solo in produzione.
// `frame-ancestors` (l'unica direttiva che servirebbe davvero) è già coperta da
// X-Frame-Options: DENY, supportato ovunque.
const SECURITY_HEADERS = [
  // Anti-clickjacking: nessun sito può incorniciare l'area admin per
  // intercettare i click su azioni tipo "elimina fumetto".
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Non far trapelare il path completo (es. /admin/comics/<id>) verso siti
  // esterni linkati; l'origine da sola basta per gli analytics altrui.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Il sito non usa nessuna di queste API: negarle in blocco vale anche per
  // eventuali iframe/script futuri.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  // Niente "X-Powered-By: Next.js": non è una difesa, ma non c'è motivo di
  // annunciare stack e versione a chi scansiona.
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
