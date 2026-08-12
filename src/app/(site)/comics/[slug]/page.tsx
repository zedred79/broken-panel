import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ContinueReadingLink } from "@/components/site/ContinueReadingLink";

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
            {readablePages.length > 0 ? (
              <ContinueReadingLink
                slug={comic.slug}
                pageCount={comic.pages.length}
              />
            ) : (
              <span className="text-muted">In progress — coming soon</span>
            )}
            <span className="text-sm text-muted">
              {readablePages.length} pages
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
