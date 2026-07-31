import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

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

  const readablePages = comic.pages.filter((p) => p._count.panels > 0);

  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <div className="grid gap-10 sm:grid-cols-[280px_1fr]">
        <div className="aspect-[2/3] overflow-hidden rounded-lg border border-border bg-surface">
          {comic.coverImage ? (
            <img
              src={comic.coverImage}
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
            Tratto da &ldquo;{comic.sourceWork}&rdquo;
            {comic.author ? ` di ${comic.author}` : ""}
          </p>
          <h1 className="font-display mt-2 text-4xl tracking-wide">
            {comic.title}
          </h1>
          {comic.style && (
            <p className="mt-2 text-sm text-muted">Stile: {comic.style}</p>
          )}
          {comic.description && (
            <p className="mt-6 max-w-2xl text-foreground/90">
              {comic.description}
            </p>
          )}

          <div className="mt-8 flex items-center gap-4">
            {readablePages.length > 0 ? (
              <Link
                href={`/read/${comic.slug}`}
                className="rounded bg-accent px-6 py-3 font-semibold text-accent-foreground transition hover:opacity-90"
              >
                Leggi ora
              </Link>
            ) : (
              <span className="text-muted">In lavorazione — presto disponibile</span>
            )}
            <span className="text-sm text-muted">
              {readablePages.length} pagine
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
