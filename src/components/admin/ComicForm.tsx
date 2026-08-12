"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ComicFormProps = {
  mode: "create" | "edit";
  comicId?: string;
  initial?: {
    title: string;
    sourceWork: string;
    author: string | null;
    description: string | null;
    style: string | null;
    status: string;
    coverImage: string | null;
  };
};

export function ComicForm({ mode, comicId, initial }: ComicFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [coverPreview, setCoverPreview] = useState<string | null>(
    initial?.coverImage ?? null
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const formData = new FormData(e.currentTarget);

    try {
      const url = mode === "create" ? "/api/comics" : `/api/comics/${comicId}`;
      const method = mode === "create" ? "POST" : "PATCH";
      const res = await fetch(url, { method, body: formData });
      const json = await res.json();

      if (!res.ok) {
        setError(json.error ?? "Unexpected error");
        setPending(false);
        return;
      }

      if (mode === "create") {
        router.push(`/admin/comics/${json.comic.id}`);
      } else {
        router.refresh();
        setPending(false);
      }
    } catch {
      setError("Network error");
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5 rounded-lg border border-border bg-surface p-6"
    >
      {error && (
        <p className="rounded border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-accent">
          {error}
        </p>
      )}

      <div className="grid gap-5 sm:grid-cols-[160px_1fr]">
        <div>
          <label className="mb-1 block text-sm text-muted">Cover</label>
          <div className="aspect-[2/3] w-full overflow-hidden rounded border border-border bg-surface-2">
            {coverPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={coverPreview}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : null}
          </div>
          <input
            type="file"
            name="cover"
            accept="image/png,image/jpeg,image/webp"
            className="mt-2 w-full text-xs text-muted"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) setCoverPreview(URL.createObjectURL(file));
            }}
          />
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="title" className="mb-1 block text-sm text-muted">
              Comic title
            </label>
            <input
              id="title"
              name="title"
              required
              defaultValue={initial?.title}
              className="w-full rounded border border-border bg-surface-2 px-3 py-2 outline-none focus:border-accent"
            />
          </div>
          <div>
            <label
              htmlFor="sourceWork"
              className="mb-1 block text-sm text-muted"
            >
              Source work (e.g. Dracula)
            </label>
            <input
              id="sourceWork"
              name="sourceWork"
              required
              defaultValue={initial?.sourceWork}
              className="w-full rounded border border-border bg-surface-2 px-3 py-2 outline-none focus:border-accent"
            />
          </div>
          <div>
            <label htmlFor="author" className="mb-1 block text-sm text-muted">
              Original author
            </label>
            <input
              id="author"
              name="author"
              defaultValue={initial?.author ?? ""}
              className="w-full rounded border border-border bg-surface-2 px-3 py-2 outline-none focus:border-accent"
            />
          </div>
          <div>
            <label htmlFor="style" className="mb-1 block text-sm text-muted">
              Art style
            </label>
            <input
              id="style"
              name="style"
              placeholder="e.g. Noir, Manga, Gothic watercolor"
              defaultValue={initial?.style ?? ""}
              className="w-full rounded border border-border bg-surface-2 px-3 py-2 outline-none focus:border-accent"
            />
          </div>
        </div>
      </div>

      <div>
        <label htmlFor="description" className="mb-1 block text-sm text-muted">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          rows={4}
          defaultValue={initial?.description ?? ""}
          className="w-full rounded border border-border bg-surface-2 px-3 py-2 outline-none focus:border-accent"
        />
      </div>

      {mode === "edit" && (
        <div>
          <label htmlFor="status" className="mb-1 block text-sm text-muted">
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={initial?.status}
            className="rounded border border-border bg-surface-2 px-3 py-2 outline-none focus:border-accent"
          >
            <option value="draft">Draft (not visible)</option>
            <option value="published">Published</option>
          </select>
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded bg-accent px-5 py-2.5 font-semibold text-accent-foreground transition hover:opacity-90 disabled:opacity-50"
      >
        {pending
          ? "Saving..."
          : mode === "create"
            ? "Create comic"
            : "Save changes"}
      </button>
    </form>
  );
}
