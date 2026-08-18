import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { deleteUploadedFile, saveCoverImage } from "@/lib/uploads";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const comic = await prisma.comic.findUnique({
    where: { id },
    include: {
      pages: {
        orderBy: { order: "asc" },
        include: { _count: { select: { panels: true } } },
      },
    },
  });

  if (!comic) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ comic });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Letto *prima* dell'update: serve sia a rispondere 404 su un id
  // inesistente (prisma.update lancerebbe P2025 -> 500, unica route del
  // progetto a non seguire il pattern delle altre) sia a sapere quale
  // copertina rimpiazzare dopo.
  const previous = await prisma.comic.findUnique({
    where: { id },
    select: { coverImage: true, coverThumbnail: true },
  });
  if (!previous) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const formData = await request.formData();

  const title = formData.get("title");
  const sourceWork = formData.get("sourceWork");
  const author = formData.get("author");
  const description = formData.get("description");
  const style = formData.get("style");
  const status = formData.get("status");
  const cover = formData.get("cover");

  const data: Record<string, unknown> = {};
  if (typeof title === "string" && title.trim()) data.title = title.trim();
  if (typeof sourceWork === "string" && sourceWork.trim())
    data.sourceWork = sourceWork.trim();
  if (typeof author === "string") data.author = author.trim() || null;
  if (typeof description === "string")
    data.description = description.trim() || null;
  if (typeof style === "string") data.style = style.trim() || null;
  if (status === "draft" || status === "published") data.status = status;

  if (cover instanceof File && cover.size > 0) {
    try {
      const saved = await saveCoverImage(cover);
      data.coverImage = saved.url;
      data.coverThumbnail = saved.thumbnailUrl;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload error";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  let comic;
  try {
    comic = await prisma.comic.update({ where: { id }, data });
  } catch (err) {
    // La nuova copertina è già stata scritta su disco a questo punto: se
    // l'update fallisce resterebbe lì per sempre, senza nessuna riga di DB
    // che la referenzi.
    if (typeof data.coverImage === "string") {
      await Promise.all([
        deleteUploadedFile(data.coverImage),
        deleteUploadedFile(data.coverThumbnail as string),
      ]);
    }
    throw err;
  }

  if (typeof data.coverImage === "string") {
    await Promise.all([
      previous.coverImage !== data.coverImage
        ? deleteUploadedFile(previous.coverImage)
        : Promise.resolve(),
      previous.coverThumbnail !== data.coverThumbnail
        ? deleteUploadedFile(previous.coverThumbnail)
        : Promise.resolve(),
    ]);
  }

  return NextResponse.json({ comic });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const comic = await prisma.comic.findUnique({
    where: { id },
    include: { pages: { select: { imageUrl: true, thumbnailUrl: true } } },
  });
  if (!comic) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.comic.delete({ where: { id } });

  await Promise.all([
    deleteUploadedFile(comic.coverImage),
    deleteUploadedFile(comic.coverThumbnail),
    ...comic.pages.flatMap((page) => [
      deleteUploadedFile(page.imageUrl),
      deleteUploadedFile(page.thumbnailUrl),
    ]),
  ]);

  return NextResponse.json({ ok: true });
}
