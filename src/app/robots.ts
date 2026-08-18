import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site-config";

// force-dynamic per lo stesso motivo del sitemap, ma con una causa diversa:
// qui non si legge dal DB, si legge SITE_URL da una variabile d'ambiente. Se
// la route fosse statica, il valore verrebbe congelato **al momento del
// build** — e l'immagine Docker viene buildata senza le env di produzione,
// quindi il sitemap dichiarato qui punterebbe a localhost.
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin/", // area riservata (già protetta da proxy.ts, ma inutile farla scansionare)
        "/api/",   // route JSON, nessun contenuto per un lettore
        "/login",
        "/read/",  // il reader è un'app client: pagina vuota per un crawler
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
