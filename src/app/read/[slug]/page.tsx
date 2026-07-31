import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ComicReader } from "@/components/reader/ComicReader";

export default async function ReadComicPage({
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
    width: page.width,
    height: page.height,
    panels: page.panels.map((panel) => ({
      points: JSON.parse(panel.points) as { x: number; y: number }[],
    })),
  }));

  return <ComicReader slug={comic.slug} title={comic.title} pages={pages} />;
}
