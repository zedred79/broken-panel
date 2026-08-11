import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";

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
    return NextResponse.json({ error: "Fumetto non trovato" }, { status: 404 });
  }

  const body = await request.json();
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  if (!title) {
    return NextResponse.json({ error: "Titolo del capitolo obbligatorio" }, { status: 400 });
  }

  const last = await prisma.chapter.findFirst({
    where: { comicId },
    orderBy: { order: "desc" },
  });
  const nextOrder = (last?.order ?? 0) + 1;

  const chapter = await prisma.chapter.create({
    data: { comicId, title, order: nextOrder },
  });

  return NextResponse.json({ chapter }, { status: 201 });
}
