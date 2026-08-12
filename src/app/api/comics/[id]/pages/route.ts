import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { savePageImage } from "@/lib/uploads";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: comicId } = await params;

  const comic = await prisma.comic.findUnique({ where: { id: comicId } });
  if (!comic) {
    return NextResponse.json({ error: "Comic not found" }, { status: 404 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  let saved;
  try {
    saved = await savePageImage(file);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload error";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const last = await prisma.page.findFirst({
    where: { comicId },
    orderBy: { order: "desc" },
  });
  const nextOrder = (last?.order ?? 0) + 1;

  const page = await prisma.page.create({
    data: {
      comicId,
      order: nextOrder,
      imageUrl: saved.url,
      thumbnailUrl: saved.thumbnailUrl,
      width: saved.width,
      height: saved.height,
    },
  });

  return NextResponse.json({ page }, { status: 201 });
}
