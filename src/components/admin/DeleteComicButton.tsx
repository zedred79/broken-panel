"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteComicButton({
  comicId,
  title,
  redirectTo,
  className,
}: {
  comicId: string;
  title: string;
  redirectTo?: string;
  className?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    if (
      !confirm(
        `Permanently delete "${title}"? All its pages and panels will be deleted too. This action cannot be undone.`
      )
    ) {
      return;
    }

    setBusy(true);
    const res = await fetch(`/api/comics/${comicId}`, { method: "DELETE" });

    if (!res.ok) {
      alert("Unable to delete the comic.");
      setBusy(false);
      return;
    }

    if (redirectTo) {
      router.push(redirectTo);
    } else {
      router.refresh();
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={busy}
      className={className ?? "text-accent hover:underline disabled:opacity-50"}
    >
      {busy ? "Deleting..." : "Delete"}
    </button>
  );
}
