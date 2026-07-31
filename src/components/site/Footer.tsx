import { SITE_FOOTER_TEXT } from "@/lib/site-config";

export function Footer() {
  return (
    <footer className="border-t border-border py-8">
      <div className="mx-auto max-w-6xl px-6 text-sm text-muted">
        <p>{SITE_FOOTER_TEXT}</p>
      </div>
    </footer>
  );
}
