import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ContinueReadingLink } from "@/components/site/ContinueReadingLink";

// È la pagina che si condivide di un fumetto, quindi è qui che servono
// davvero titolo, descrizione e immagine propri: senza, ogni fumetto
// erediterebbe il titolo generico del layout radice e incollare il link in
// una chat non mostrerebbe né copertina né titolo. Next chiama questa
// funzione in parallelo al render della pagina, quindi la seconda query non
// aggiunge latenza percepibile (e SQLite è in-process).
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const comic = await prisma.comic.findUnique({
    where: { slug },
    select: {
      title: true,
      description: true,
      sourceWork: true,
      author: true,
      style: true,
      status: true,
      coverImage: true,
    },
  });

  // Stessa condizione del componente qui sotto: una bozza non deve esporre
  // titolo e trama nei metadata di una pagina che poi risponde 404.
  if (!comic || comic.status !== "published") {
    return { title: "Comic not found" };
  }

  const byline = comic.author ? ` by ${comic.author}` : "";
  const description =
    comic.description ||
    `${comic.title} — an AI-generated comic based on "${comic.sourceWork}"${byline}` +
      (comic.style ? `, in a ${comic.style} style.` : ".");

  return {
    title: comic.title,
    description,
    alternates: { canonical: `/comics/${slug}` },
    openGraph: {
      type: "article",
      title: comic.title,
      description,
      url: `/comics/${slug}`,
      // La copertina a piena risoluzione, non il thumbnail da 480px: le
      // piattaforme la riscalano da sole e una sorgente piccola verrebbe
      // mostrata sgranata.
      images: comic.coverImage
        ? [{ url: comic.coverImage, alt: comic.title }]
        : undefined,
    },
    twitter: {
      card: comic.coverImage ? "summary_large_image" : "summary",
      title: comic.title,
      description,
      images: comic.coverImage ? [comic.coverImage] : undefined,
    },
  };
}

export default async function ComicDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const comic = await prisma.comic.findUnique({
    where: { slug },
    include: {
      pages: {
        orderBy: { order: "asc" },
        include: { _count: { select: { panels: true } } },
      },
    },
  });

  if (!comic || comic.status !== "published") {
    notFound();
  }

  // Serve solo a decidere se c'è qualcosa da leggere: basta una vignetta su
  // una qualsiasi pagina. Il *conteggio* mostrato al lettore invece è
  // comic.pages.length, perché il reader sfoglia tutte le tavole caricate,
  // anche quelle non ancora ritagliate in vignette (mostrate a pagina intera).
  const hasReadablePages = comic.pages.some((p) => p._count.panels > 0);

  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <div className="grid gap-10 sm:grid-cols-[280px_1fr]">
        <div className="aspect-[2/3] overflow-hidden rounded-lg border border-border bg-surface">
          {comic.coverImage ? (
            <img
              src={comic.coverThumbnail ?? comic.coverImage}
              alt={comic.title}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <img
                src="/logo-mark.svg"
                alt=""
                className="h-16 w-auto opacity-40"
              />
            </div>
          )}
        </div>

        <div>
          <p className="text-sm uppercase tracking-wide text-accent">
            Based on &ldquo;{comic.sourceWork}&rdquo;
            {comic.author ? ` by ${comic.author}` : ""}
          </p>
          <h1 className="font-display mt-2 text-4xl tracking-wide">
            {comic.title}
          </h1>
          {comic.style && (
            <p className="mt-2 text-sm text-muted">Style: {comic.style}</p>
          )}
          {comic.description && (
            <p className="mt-6 max-w-2xl text-foreground/90">
              {comic.description}
            </p>
          )}

          <div className="mt-8 flex items-center gap-4">
            {hasReadablePages ? (
              <ContinueReadingLink
                slug={comic.slug}
                pageCount={comic.pages.length}
              />
            ) : (
              <span className="text-muted">In progress — coming soon</span>
            )}
            <span className="text-sm text-muted">
              {comic.pages.length} pages
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
