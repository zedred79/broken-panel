import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { DeleteComicButton } from "@/components/admin/DeleteComicButton";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const comics = await prisma.comic.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { pages: true } } },
  });

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <h1 className="font-display text-3xl tracking-wide">I tuoi fumetti</h1>
        <Link
          href="/admin/comics/new"
          className="rounded bg-accent px-4 py-2 font-semibold text-accent-foreground transition hover:opacity-90"
        >
          + Nuovo fumetto
        </Link>
      </div>

      {comics.length === 0 ? (
        <p className="text-muted">
          Nessun fumetto ancora. Creane uno per iniziare.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Titolo</th>
                <th className="px-4 py-3 font-medium">Opera originale</th>
                <th className="px-4 py-3 font-medium">Stato</th>
                <th className="px-4 py-3 font-medium">Pagine</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {comics.map((comic) => (
                <tr key={comic.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">{comic.title}</td>
                  <td className="px-4 py-3 text-muted">{comic.sourceWork}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        comic.status === "published"
                          ? "rounded bg-green-900/40 px-2 py-1 text-xs text-green-400"
                          : "rounded bg-surface-2 px-2 py-1 text-xs text-muted"
                      }
                    >
                      {comic.status === "published" ? "Pubblicato" : "Bozza"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted">{comic._count.pages}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-4">
                      <Link
                        href={`/admin/comics/${comic.id}`}
                        className="text-accent hover:underline"
                      >
                        Gestisci
                      </Link>
                      <DeleteComicButton comicId={comic.id} title={comic.title} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
