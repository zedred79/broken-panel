import Link from "next/link";
import { getSiteSettings } from "@/lib/site-settings";

export async function Navbar() {
  const { headerLogo } = await getSiteSettings();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-3">
          <img src={headerLogo} alt="" className="h-9 w-auto" />
          <span className="font-display text-2xl tracking-wider">
            BROKEN PANEL
          </span>
        </Link>
        <nav className="flex items-center gap-6 text-sm text-muted">
          <Link href="/" className="transition hover:text-foreground">
            Catalog
          </Link>
          <Link
            href="/admin"
            className="rounded border border-border px-3 py-1.5 transition hover:border-accent hover:text-foreground"
          >
            Admin
          </Link>
        </nav>
      </div>
    </header>
  );
}
