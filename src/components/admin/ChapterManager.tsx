"use client";

import { adminRequest, adminErrorMessage } from "@/lib/admin-request";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ChapterItem = {
  id: string;
  title: string;
};

export function ChapterManager({
  comicId,
  chapters,
}: {
  comicId: string;
  chapters: ChapterItem[];
}) {
  const router = useRouter();
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;

    setCreating(true);
    setError(null);
    try {
      await adminRequest(`/api/comics/${comicId}/chapters`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      setNewTitle("");
      router.refresh();
    } catch (error) {
      setError(adminErrorMessage(error));
    } finally {
      setCreating(false);
    }
  }

  async function updateChapter(chapterId: string, init: RequestInit): Promise<boolean> {
    setBusyId(chapterId);
    setError(null);
    try {
      await adminRequest(`/api/chapters/${chapterId}`, init);
      router.refresh();
      return true;
    } catch (error) {
      setError(adminErrorMessage(error));
      return false;
    } finally {
      setBusyId(null);
    }
  }

  async function move(chapterId: string, direction: "up" | "down") {
    await updateChapter(chapterId, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ direction }),
    });
  }

  async function rename(chapterId: string) {
    const title = renameValue.trim();
    if (!title) {
      setRenamingId(null);
      return;
    }
    const saved = await updateChapter(chapterId, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (saved) setRenamingId(null);
  }

  async function remove(chapterId: string) {
    if (!confirm("Delete this chapter? Its pages will remain, without a chapter.")) return;
    await updateChapter(chapterId, { method: "DELETE" });
  }

  return (
    <div>
      <h2 className="font-display mb-4 text-2xl tracking-wide">Chapters</h2>

      {error && (
        <p className="mb-4 rounded border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-accent">
          {error}
        </p>
      )}

      {chapters.length === 0 ? (
        <p className="mb-4 text-muted">No chapters. Pages are listed as a single block.</p>
      ) : (
        <ul className="mb-4 space-y-2">
          {chapters.map((chapter, i) => (
            <li
              key={chapter.id}
              className="flex items-center justify-between gap-3 rounded border border-border bg-surface px-3 py-2"
            >
              {renamingId === chapter.id ? (
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={() => rename(chapter.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") rename(chapter.id);
                    if (e.key === "Escape") setRenamingId(null);
                  }}
                  className="flex-1 rounded border border-border bg-surface-2 px-2 py-1 text-sm outline-none focus:border-accent"
                />
              ) : (
                <button
                  onClick={() => {
                    setRenamingId(chapter.id);
                    setRenameValue(chapter.title);
                  }}
                  className="flex-1 text-left text-sm hover:underline"
                >
                  {chapter.title}
                </button>
              )}

              <div className="flex items-center gap-2 text-xs">
                <button
                  disabled={busyId === chapter.id || i === 0}
                  onClick={() => move(chapter.id, "up")}
                  className="rounded border border-border px-2 py-1 disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  disabled={busyId === chapter.id || i === chapters.length - 1}
                  onClick={() => move(chapter.id, "down")}
                  className="rounded border border-border px-2 py-1 disabled:opacity-30"
                >
                  ↓
                </button>
                <button
                  disabled={busyId === chapter.id}
                  onClick={() => remove(chapter.id)}
                  className="text-accent hover:underline"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={create} className="flex gap-2">
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="New chapter title"
          className="flex-1 rounded border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={creating || !newTitle.trim()}
          className="rounded bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition hover:opacity-90 disabled:opacity-50"
        >
          {creating ? "Creating..." : "+ New chapter"}
        </button>
      </form>
    </div>
  );
}
