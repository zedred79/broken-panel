import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ComicReader } from "@/components/reader/ComicReader";

// Il reader è un'app client: per un crawler è una pagina praticamente vuota,
// e indicizzarla vorrebbe dire farla competere con la scheda del fumetto
// (quella sì con testo, copertina e descrizione). Da qui il noindex, che
// raddoppia il disallow già presente in robots.ts — il disallow impedisce la
// scansione, il noindex l'indicizzazione anche se ci si arriva da un link
// esterno. `follow` resta attivo per non disperdere i link verso la scheda.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const comic = await prisma.comic.findUnique({
    where: { slug },
    select: { title: true, status: true },
  });

  return {
    title: comic && comic.status === "published" ? `Reading ${comic.title}` : "Reader",
    robots: { index: false, follow: true },
  };
}

export default async function ReadComicPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { slug } = await params;
  const { page } = await searchParams;

  const comic = await prisma.comic.findUnique({
    where: { slug },
    include: {
      pages: {
        orderBy: { order: "asc" },
        include: {
          panels: { orderBy: { order: "asc" } },
          chapter: { select: { title: true } },
        },
      },
    },
  });

  if (!comic || comic.status !== "published" || comic.pages.length === 0) {
    notFound();
  }

  const pages = comic.pages.map((page) => ({
    id: page.id,
    imageUrl: page.imageUrl,
    thumbnailUrl: page.thumbnailUrl,
    width: page.width,
    height: page.height,
    chapterTitle: page.chapter?.title ?? null,
    panels: page.panels.map((panel) => ({
      points: JSON.parse(panel.points) as { x: number; y: number }[],
    })),
  }));

  const parsedPage = page ? Number.parseInt(page, 10) : NaN;
  const initialPageIndex = Number.isInteger(parsedPage) ? parsedPage - 1 : 0;

  return (
    <ComicReader
      slug={comic.slug}
      title={comic.title}
      pages={pages}
      initialPageIndex={initialPageIndex}
    />
  );
}
