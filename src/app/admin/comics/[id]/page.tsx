import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ComicForm } from "@/components/admin/ComicForm";
import { PageManager } from "@/components/admin/PageManager";
import { DeleteComicButton } from "@/components/admin/DeleteComicButton";

export default async function EditComicPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const comic = await prisma.comic.findUnique({
    where: { id },
    include: {
      pages: {
        orderBy: { order: "asc" },
        include: { _count: { select: { panels: true } } },
      },
    },
  });

  if (!comic) notFound();

  return (
    <div className="space-y-12">
      <div>
        <h1 className="font-display mb-8 text-3xl tracking-wide">
          {comic.title}
        </h1>
        <ComicForm
          mode="edit"
          comicId={comic.id}
          initial={{
            title: comic.title,
            sourceWork: comic.sourceWork,
            author: comic.author,
            description: comic.description,
            style: comic.style,
            status: comic.status,
            coverImage: comic.coverImage,
          }}
        />
      </div>

      <PageManager comicId={comic.id} pages={comic.pages} />

      <div className="rounded-lg border border-accent/30 bg-accent/5 p-6">
        <h2 className="font-display mb-1 text-xl tracking-wide">
          Zona pericolosa
        </h2>
        <p className="mb-4 text-sm text-muted">
          Elimina definitivamente questo fumetto, tutte le sue pagine e
          vignette.
        </p>
        <DeleteComicButton
          comicId={comic.id}
          title={comic.title}
          redirectTo="/admin"
          className="rounded border border-accent px-4 py-2 text-sm font-semibold text-accent transition hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
        />
      </div>
    </div>
  );
}
