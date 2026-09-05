import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { slugify } from "@/lib/slugify";
import { deleteUploadedFile, saveCoverImage } from "@/lib/uploads";

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
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }
  if (typeof sourceWork !== "string" || sourceWork.trim() === "") {
    return NextResponse.json(
      { error: "Source work is required" },
      { status: 400 }
    );
  }

  const baseSlug = slugify(title) || "comic";
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
      const message = err instanceof Error ? err.message : "Upload error";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  let comic;
  try {
    comic = await prisma.comic.create({
      data: {
        title: title.trim(),
        slug,
        sourceWork: sourceWork.trim(),
        author:
          typeof author === "string" && author.trim() ? author.trim() : null,
        description:
          typeof description === "string" && description.trim()
            ? description.trim()
            : null,
        style: typeof style === "string" && style.trim() ? style.trim() : null,
        coverImage,
        coverThumbnail,
      },
    });
  } catch (err) {
    // La copertina è già su disco a questo punto: senza questo cleanup un
    // fallimento della create (es. slug diventato duplicato per una richiesta
    // concorrente) lascerebbe file orfani. Stesso pattern del PATCH in
    // ./[id]/route.ts.
    await Promise.all([
      deleteUploadedFile(coverImage),
      deleteUploadedFile(coverThumbnail),
    ]);
    throw err;
  }

  return NextResponse.json({ comic }, { status: 201 });
}
