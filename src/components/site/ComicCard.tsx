import Link from "next/link";

type ComicCardProps = {
  slug: string;
  title: string;
  sourceWork: string;
  style: string | null;
  coverImage: string | null;
};

export function ComicCard({
  slug,
  title,
  sourceWork,
  style,
  coverImage,
}: ComicCardProps) {
  return (
    <Link
      href={`/comics/${slug}`}
      className="group block overflow-hidden rounded-lg border border-border bg-surface transition hover:border-accent"
    >
      <div className="aspect-[2/3] w-full overflow-hidden bg-surface-2">
        {coverImage ? (
          <img
            src={coverImage}
            alt={title}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted">
            <img src="/logo-mark.svg" alt="" className="h-16 w-auto opacity-40" />
          </div>
        )}
      </div>
      <div className="p-4">
        <p className="text-xs uppercase tracking-wide text-accent">
          {sourceWork}
        </p>
        <h3 className="font-display text-xl tracking-wide">{title}</h3>
        {style && <p className="mt-1 text-sm text-muted">{style}</p>}
      </div>
    </Link>
  );
}
