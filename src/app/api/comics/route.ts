import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { slugify } from "@/lib/slugify";
import { saveCoverImage } from "@/lib/uploads";

export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const comics = await prisma.comic.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { pages: true } } },
  });

  return NextResponse.json({ comics });
}

export async function POST(request: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const title = formData.get("title");
  const sourceWork = formData.get("sourceWork");
  const author = formData.get("author");
  const description = formData.get("description");
  const style = formData.get("style");
  const cover = formData.get("cover");

  if (typeof title !== "string" || title.trim() === "") {
    return NextResponse.json({ error: "Il titolo è obbligatorio" }, { status: 400 });
  }
  if (typeof sourceWork !== "string" || sourceWork.trim() === "") {
    return NextResponse.json(
      { error: "L'opera originale è obbligatoria" },
      { status: 400 }
    );
  }

  const baseSlug = slugify(title) || "fumetto";
  let slug = baseSlug;
  let i = 1;
  while (await prisma.comic.findUnique({ where: { slug } })) {
    i += 1;
    slug = `${baseSlug}-${i}`;
  }

  let coverImage: string | null = null;
  let coverThumbnail: string | null = null;
  if (cover instanceof File && cover.size > 0) {
    try {
      const saved = await saveCoverImage(cover);
      coverImage = saved.url;
      coverThumbnail = saved.thumbnailUrl;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Errore di upload";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  const comic = await prisma.comic.create({
    data: {
      title: title.trim(),
      slug,
      sourceWork: sourceWork.trim(),
      author: typeof author === "string" && author.trim() ? author.trim() : null,
      description:
        typeof description === "string" && description.trim()
          ? description.trim()
          : null,
      style: typeof style === "string" && style.trim() ? style.trim() : null,
      coverImage,
      coverThumbnail,
    },
  });

  return NextResponse.json({ comic }, { status: 201 });
}
