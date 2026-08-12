"use client";

import { Fragment, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type PageItem = {
  id: string;
  order: number;
  imageUrl: string;
  thumbnailUrl: string | null;
  chapterId: string | null;
  _count: { panels: number };
};

type ChapterOption = {
  id: string;
  title: string;
};

export function PageManager({
  comicId,
  pages,
  chapters,
}: {
  comicId: string;
  pages: PageItem[];
  chapters: ChapterOption[];
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    const formData = new FormData();
    formData.set("file", file);

    const res = await fetch(`/api/comics/${comicId}/pages`, {
      method: "POST",
      body: formData,
    });
    const json = await res.json();

    if (!res.ok) {
      setError(json.error ?? "Upload error");
    } else {
      router.refresh();
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function move(pageId: string, direction: "up" | "down") {
    setBusyId(pageId);
    await fetch(`/api/pages/${pageId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ direction }),
    });
    router.refresh();
    setBusyId(null);
  }

  async function remove(pageId: string) {
    if (!confirm("Delete this page and all its panels?")) return;
    setBusyId(pageId);
    await fetch(`/api/pages/${pageId}`, { method: "DELETE" });
    router.refresh();
    setBusyId(null);
  }

  async function assignChapter(pageId: string, chapterId: string | null) {
    setBusyId(pageId);
    await fetch(`/api/pages/${pageId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chapterId }),
    });
    router.refresh();
    setBusyId(null);
  }

  const chapterTitleById = new Map(chapters.map((c) => [c.id, c.title]));
  const showGroupHeaders = chapters.length > 0;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-2xl tracking-wide">Pages</h2>
        <label className="cursor-pointer rounded bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition hover:opacity-90">
          {uploading ? "Uploading..." : "+ Upload page"}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            disabled={uploading}
            onChange={handleUpload}
          />
        </label>
      </div>

      {error && (
        <p className="mb-4 rounded border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-accent">
          {error}
        </p>
      )}

      {pages.length === 0 ? (
        <p className="text-muted">
          No pages uploaded yet. Upload the first page of the comic.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {pages.map((page, i) => {
            const showHeader =
              showGroupHeaders &&
              (i === 0 || pages[i - 1].chapterId !== page.chapterId);

            return (
              <Fragment key={page.id}>
                {showHeader && (
                  <h3
                    key={`header-${page.id}`}
                    className="col-span-full mt-2 first:mt-0 text-sm font-semibold uppercase tracking-wide text-muted"
                  >
                    {page.chapterId
                      ? chapterTitleById.get(page.chapterId) ?? "Chapter"
                      : "No chapter"}
                  </h3>
                )}
                <div
                  key={page.id}
                  className="overflow-hidden rounded-lg border border-border bg-surface"
                >
                  <Link href={`/admin/comics/${comicId}/pages/${page.id}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={page.thumbnailUrl ?? page.imageUrl}
                      alt={`Page ${page.order}`}
                      className="aspect-[3/4] w-full object-cover"
                    />
                  </Link>
                  <div className="p-3">
                    <p className="text-sm font-medium">Page {i + 1}</p>
                    <p className="text-xs text-muted">
                      {page._count.panels} panels
                      {page._count.panels === 0 && " — needs cropping"}
                    </p>
                    {chapters.length > 0 && (
                      <select
                        value={page.chapterId ?? ""}
                        disabled={busyId === page.id}
                        onChange={(e) =>
                          assignChapter(page.id, e.target.value || null)
                        }
                        className="mt-2 w-full rounded border border-border bg-surface-2 px-2 py-1 text-xs outline-none focus:border-accent"
                      >
                        <option value="">No chapter</option>
                        {chapters.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.title}
                          </option>
                        ))}
                      </select>
                    )}
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <div className="flex gap-2">
                        <button
                          disabled={busyId === page.id || i === 0}
                          onClick={() => move(page.id, "up")}
                          className="rounded border border-border px-2 py-1 disabled:opacity-30"
                        >
                          ↑
                        </button>
                        <button
                          disabled={busyId === page.id || i === pages.length - 1}
                          onClick={() => move(page.id, "down")}
                          className="rounded border border-border px-2 py-1 disabled:opacity-30"
                        >
                          ↓
                        </button>
                      </div>
                      <button
                        disabled={busyId === page.id}
                        onClick={() => remove(page.id)}
                        className="text-accent hover:underline"
                      >
                        Delete
                      </button>
                    </div>
                    <Link
                      href={`/admin/comics/${comicId}/pages/${page.id}`}
                      className="mt-2 block text-center text-xs text-accent hover:underline"
                    >
                      Crop panels →
                    </Link>
                  </div>
                </div>
              </Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
}
