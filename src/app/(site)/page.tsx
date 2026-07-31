import { prisma } from "@/lib/prisma";
import { ComicCard } from "@/components/site/ComicCard";
import { SITE_HERO_TITLE, SITE_HERO_SUBTITLE } from "@/lib/site-config";
import { getSiteSettings } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [comics, { heroLogo }] = await Promise.all([
    prisma.comic.findMany({
      where: { status: "published" },
      orderBy: { createdAt: "desc" },
    }),
    getSiteSettings(),
  ]);

  return (
    <div>
      <section className="relative overflow-hidden border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-24 text-center">
          <img src={heroLogo} alt="" className="mx-auto mb-8 h-24 w-auto" />
          <h1 className="font-display text-5xl tracking-wide sm:text-6xl">
            {SITE_HERO_TITLE}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted">
            {SITE_HERO_SUBTITLE}
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="font-display mb-8 text-2xl tracking-wide">
          Catalogo
        </h2>
        {comics.length === 0 ? (
          <p className="text-muted">
            Nessun fumetto pubblicato ancora. Torna presto.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
            {comics.map((comic) => (
              <ComicCard
                key={comic.id}
                slug={comic.slug}
                title={comic.title}
                sourceWork={comic.sourceWork}
                style={comic.style}
                coverImage={comic.coverImage}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
