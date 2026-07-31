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
        `Eliminare definitivamente "${title}"? Verranno cancellate anche tutte le pagine e le vignette. L'operazione non è reversibile.`
      )
    ) {
      return;
    }

    setBusy(true);
    const res = await fetch(`/api/comics/${comicId}`, { method: "DELETE" });

    if (!res.ok) {
      alert("Impossibile eliminare il fumetto.");
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
      {busy ? "Eliminazione..." : "Elimina"}
    </button>
  );
}
