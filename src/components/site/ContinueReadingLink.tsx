"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { getReadingProgress } from "@/lib/reading-progress";

// localStorage non è leggibile durante l'SSR: useSyncExternalStore gestisce
// correttamente il fallback lato server (null, cioè "nessun progresso",
// stesso markup di partenza per server e client) e la lettura del valore
// vero subito dopo l'idratazione, senza il warning di React su setState
// dentro un useEffect.
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function getServerSnapshot() {
  return null;
}

export function ContinueReadingLink({
  slug,
  pageCount,
}: {
  slug: string;
  pageCount: number;
}) {
  const savedPageIndex = useSyncExternalStore(
    subscribe,
    () => {
      const saved = getReadingProgress(slug);
      return saved !== null && saved >= 0 && saved < pageCount ? saved : null;
    },
    getServerSnapshot
  );

  if (savedPageIndex === null) {
    return (
      <Link
        href={`/read/${slug}`}
        className="rounded bg-accent px-6 py-3 font-semibold text-accent-foreground transition hover:opacity-90"
      >
        Leggi ora
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <Link
        href={`/read/${slug}?page=${savedPageIndex + 1}`}
        className="rounded bg-accent px-6 py-3 font-semibold text-accent-foreground transition hover:opacity-90"
      >
        Continua da pagina {savedPageIndex + 1}
      </Link>
      <Link
        href={`/read/${slug}`}
        className="text-sm text-muted hover:text-foreground hover:underline"
      >
        Ricomincia dall&apos;inizio
      </Link>
    </div>
  );
}
