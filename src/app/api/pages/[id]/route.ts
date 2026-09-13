import { readJsonObject } from "@/lib/api-input";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { deleteUploadedFile } from "@/lib/uploads";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await readJsonObject(request);
  if (!body) {
    return NextResponse.json({ error: "Expected a valid JSON object" }, { status: 400 });
  }

  const page = await prisma.page.findUnique({ where: { id } });
  if (!page) {
    return NextResponse.json({ error: "Page not found" }, { status: 404 });
  }

  if ("chapterId" in body) {
    const chapterId = body.chapterId;
    if (chapterId !== null && (typeof chapterId !== "string" || !chapterId.trim())) {
      return NextResponse.json({ error: "Invalid chapterId" }, { status: 400 });
    }
    if (chapterId) {
      const chapter = await prisma.chapter.findUnique({ where: { id: chapterId } });
      if (!chapter || chapter.comicId !== page.comicId) {
        return NextResponse.json({ error: "Chapter not found" }, { status: 404 });
      }
    }
    const updated = await prisma.page.update({ where: { id }, data: { chapterId } });
    return NextResponse.json({ page: updated });
  }

  const direction = body?.direction;

  if (direction !== "up" && direction !== "down") {
    return NextResponse.json({ error: "Invalid direction" }, { status: 400 });
  }

  const neighbor = await prisma.page.findFirst({
    where: {
      comicId: page.comicId,
      order: direction === "up" ? { lt: page.order } : { gt: page.order },
    },
    orderBy: { order: direction === "up" ? "desc" : "asc" },
  });

  if (!neighbor) {
    return NextResponse.json({ page });
  }

  await prisma.$transaction([
    prisma.page.update({ where: { id: page.id }, data: { order: -1 } }),
    prisma.page.update({
      where: { id: neighbor.id },
      data: { order: page.order },
    }),
    prisma.page.update({
      where: { id: page.id },
      data: { order: neighbor.order },
    }),
  ]);

  return NextResponse.json({ ok: true });
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

  const page = await prisma.page.findUnique({
    where: { id },
    select: { imageUrl: true, thumbnailUrl: true },
  });
  if (!page) {
    return NextResponse.json({ error: "Page not found" }, { status: 404 });
  }

  await prisma.page.delete({ where: { id } });
  await Promise.all([
    deleteUploadedFile(page.imageUrl),
    deleteUploadedFile(page.thumbnailUrl),
  ]);

  return NextResponse.json({ ok: true });
}
