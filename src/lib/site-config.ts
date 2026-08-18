// URL pubblico del sito (con protocollo, senza barra finale). Serve a rendere
// assoluti gli URL nei metadata: le anteprime social (OpenGraph) e i crawler
// non sanno risolvere un path relativo come "/uploads/cover.png".
//
// Di default riusa NEXTAUTH_URL, che è già "l'URL pubblico con cui il sito è
// raggiungibile" e in produzione è sempre valorizzata — così non c'è una
// seconda variabile da ricordarsi di impostare. SITE_URL esiste solo per il
// caso in cui i due valori debbano divergere.
export const SITE_URL = (
  process.env.SITE_URL ||
  process.env.NEXTAUTH_URL ||
  "http://localhost:3000"
).replace(/\/+$/, "");

export const SITE_HERO_TITLE =
  process.env.SITE_HERO_TITLE || "CLASSICS, BROKEN INTO PANELS";

export const SITE_HERO_SUBTITLE =
  process.env.SITE_HERO_SUBTITLE ||
  "Broken Panel turns great novels — Dumas, Stoker, Poe — into AI-generated comics, each in a different visual style. Read them page by page, panel by panel.";

export const SITE_FOOTER_TEXT =
  process.env.SITE_FOOTER_TEXT ||
  `© ${new Date().getFullYear()} Broken Panel — Comic Publishing. Literary classics reimagined as comics with AI.`;
