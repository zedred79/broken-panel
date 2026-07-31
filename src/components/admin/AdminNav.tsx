import Link from "next/link";
import { signOut } from "@/lib/auth";

export function AdminNav() {
  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/admin" className="flex items-center gap-3">
          <img src="/logo-mark.svg" alt="" className="h-8 w-auto" />
          <span className="font-display text-xl tracking-wider">
            BROKEN PANEL <span className="text-muted">/ ADMIN</span>
          </span>
        </Link>
        <nav className="flex items-center gap-4 text-sm text-muted">
          <Link href="/admin/settings" className="transition hover:text-foreground">
            Impostazioni
          </Link>
          <Link href="/" className="transition hover:text-foreground">
            Vedi sito
          </Link>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button
              type="submit"
              className="rounded border border-border px-3 py-1.5 transition hover:border-accent hover:text-foreground"
            >
              Esci
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}
