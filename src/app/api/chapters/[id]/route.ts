import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();

  const chapter = await prisma.chapter.findUnique({ where: { id } });
  if (!chapter) {
    return NextResponse.json({ error: "Capitolo non trovato" }, { status: 404 });
  }

  if (typeof body?.title === "string") {
    const title = body.title.trim();
    if (!title) {
      return NextResponse.json({ error: "Titolo del capitolo obbligatorio" }, { status: 400 });
    }
    const updated = await prisma.chapter.update({ where: { id }, data: { title } });
    return NextResponse.json({ chapter: updated });
  }

  const direction = body?.direction;
  if (direction !== "up" && direction !== "down") {
    return NextResponse.json({ error: "direction non valida" }, { status: 400 });
  }

  const neighbor = await prisma.chapter.findFirst({
    where: {
      comicId: chapter.comicId,
      order: direction === "up" ? { lt: chapter.order } : { gt: chapter.order },
    },
    orderBy: { order: direction === "up" ? "desc" : "asc" },
  });

  if (!neighbor) {
    return NextResponse.json({ chapter });
  }

  await prisma.$transaction([
    prisma.chapter.update({ where: { id: chapter.id }, data: { order: -1 } }),
    prisma.chapter.update({
      where: { id: neighbor.id },
      data: { order: chapter.order },
    }),
    prisma.chapter.update({
      where: { id: chapter.id },
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

  const chapter = await prisma.chapter.findUnique({ where: { id } });
  if (!chapter) {
    return NextResponse.json({ error: "Capitolo non trovato" }, { status: 404 });
  }

  await prisma.chapter.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
