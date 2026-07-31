import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PanelEditor } from "@/components/admin/PanelEditor";

export default async function PagePanelEditorPage({
  params,
}: {
  params: Promise<{ id: string; pageId: string }>;
}) {
  const { id, pageId } = await params;

  const page = await prisma.page.findUnique({
    where: { id: pageId },
    include: { panels: { orderBy: { order: "asc" } } },
  });

  if (!page || page.comicId !== id) notFound();

  const initialPanels = page.panels.map((panel) => ({
    points: JSON.parse(panel.points) as { x: number; y: number }[],
  }));

  return (
    <div>
      <h1 className="font-display mb-2 text-3xl tracking-wide">
        Ritaglia vignette
      </h1>
      <p className="mb-8 text-sm text-muted">
        Disegna un poligono attorno a ogni vignetta, nell&apos;ordine in cui
        va letta.
      </p>
      <PanelEditor
        pageId={page.id}
        comicId={id}
        imageUrl={page.imageUrl}
        initialPanels={initialPanels}
      />
    </div>
  );
}
