"use client";

import { adminRequest, adminErrorMessage } from "@/lib/admin-request";

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
    try {
      await adminRequest(`/api/comics/${comicId}`, { method: "DELETE" });
      if (redirectTo) {
        router.push(redirectTo);
      } else {
        router.refresh();
      }
    } catch (error) {
      alert(adminErrorMessage(error));
    } finally {
      setBusy(false);
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
