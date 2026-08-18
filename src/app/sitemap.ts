import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/site-config";

// Stessa insidia di homepage e dashboard admin (vedi PROJECT.md): questa è
// una route che legge dal DB con una query Prisma diretta, quindi senza
// questo export Next la prerenderizzerebbe **una sola volta in build** e un
// fumetto pubblicato dopo non comparirebbe mai nel sitemap finché non si
// rifà il build. Verificabile con `npm run build`: /sitemap.xml deve essere
// marcata `ƒ`, non `○`.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const comics = await prisma.comic.findMany({
    where: { status: "published" },
    select: { slug: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  });

  // Solo le pagine con contenuto indicizzabile: niente /read/* (vedi
  // robots.ts e il noindex in read/[slug]/page.tsx), niente /admin, niente
  // /login.
  return [
    {
      url: `${SITE_URL}/`,
      // Il catalogo cambia quando cambia un fumetto: riusare la data del più
      // recente evita di dichiarare una modifica ad ogni richiesta, cosa che
      // porterebbe i crawler a ignorare del tutto il campo.
      lastModified: comics[0]?.updatedAt ?? new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    ...comics.map((comic) => ({
      url: `${SITE_URL}/comics/${comic.slug}`,
      lastModified: comic.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];
}
