import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ComicReader } from "@/components/reader/ComicReader";

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
        include: { panels: { orderBy: { order: "asc" } } },
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
