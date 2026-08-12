"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  initial: {
    headerLogo: string | null;
    heroLogo: string | null;
    defaultHeaderLogo: string;
    defaultHeroLogo: string;
  };
};

function LogoField({
  label,
  hint,
  current,
  defaultSrc,
  inputRef,
  onFileChange,
  onReset,
  isCustom,
}: {
  label: string;
  hint: string;
  current: string;
  defaultSrc: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onFileChange: (file: File | null) => void;
  onReset: () => void;
  isCustom: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-6">
      <h3 className="font-display text-lg tracking-wide">{label}</h3>
      <p className="mb-4 text-sm text-muted">{hint}</p>

      <div className="flex items-center gap-6">
        <div className="flex h-24 w-24 items-center justify-center rounded border border-border bg-black">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={current} alt="" className="max-h-20 max-w-20" />
        </div>

        <div className="space-y-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="block text-xs text-muted"
            onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
          />
          {isCustom && (
            <button
              type="button"
              onClick={onReset}
              className="text-xs text-accent hover:underline"
            >
              Restore default logo ({defaultSrc})
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function SiteSettingsForm({ initial }: Props) {
  const router = useRouter();
  const headerInputRef = useRef<HTMLInputElement>(null);
  const heroInputRef = useRef<HTMLInputElement>(null);

  const [headerPreview, setHeaderPreview] = useState(
    initial.headerLogo || initial.defaultHeaderLogo
  );
  const [heroPreview, setHeroPreview] = useState(
    initial.heroLogo || initial.defaultHeroLogo
  );
  const [isHeaderCustom, setIsHeaderCustom] = useState(Boolean(initial.headerLogo));
  const [isHeroCustom, setIsHeroCustom] = useState(Boolean(initial.heroLogo));
  const [clearHeader, setClearHeader] = useState(false);
  const [clearHero, setClearHero] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function handleHeaderFile(file: File | null) {
    if (!file) return;
    setClearHeader(false);
    setIsHeaderCustom(true);
    setHeaderPreview(URL.createObjectURL(file));
  }

  function handleHeroFile(file: File | null) {
    if (!file) return;
    setClearHero(false);
    setIsHeroCustom(true);
    setHeroPreview(URL.createObjectURL(file));
  }

  function resetHeader() {
    setClearHeader(true);
    setIsHeaderCustom(false);
    setHeaderPreview(initial.defaultHeaderLogo);
    if (headerInputRef.current) headerInputRef.current.value = "";
  }

  function resetHero() {
    setClearHero(true);
    setIsHeroCustom(false);
    setHeroPreview(initial.defaultHeroLogo);
    if (heroInputRef.current) heroInputRef.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setSaved(false);

    const formData = new FormData();
    if (headerInputRef.current?.files?.[0]) {
      formData.set("headerLogo", headerInputRef.current.files[0]);
    }
    if (heroInputRef.current?.files?.[0]) {
      formData.set("heroLogo", heroInputRef.current.files[0]);
    }
    formData.set("clearHeaderLogo", String(clearHeader));
    formData.set("clearHeroLogo", String(clearHero));

    const res = await fetch("/api/site-settings", { method: "PUT", body: formData });
    const json = await res.json();

    if (!res.ok) {
      setError(json.error ?? "Unexpected error");
      setPending(false);
      return;
    }

    setClearHeader(false);
    setClearHero(false);
    setSaved(true);
    setPending(false);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <p className="rounded border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-accent">
          {error}
        </p>
      )}

      <LogoField
        label="Header logo"
        hint="Shown in the public site's navigation bar."
        current={headerPreview}
        defaultSrc={initial.defaultHeaderLogo}
        inputRef={headerInputRef}
        onFileChange={handleHeaderFile}
        onReset={resetHeader}
        isCustom={isHeaderCustom}
      />

      <LogoField
        label="Hero logo"
        hint="Shown large in the homepage's opening section."
        current={heroPreview}
        defaultSrc={initial.defaultHeroLogo}
        inputRef={heroInputRef}
        onFileChange={handleHeroFile}
        onReset={resetHero}
        isCustom={isHeroCustom}
      />

      <button
        type="submit"
        disabled={pending}
        className="rounded bg-accent px-5 py-2.5 font-semibold text-accent-foreground transition hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Saving..." : "Save settings"}
      </button>
      {saved && <p className="text-sm text-green-400">Saved ✓</p>}
    </form>
  );
}
