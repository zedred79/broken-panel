import { readJsonObject } from "@/lib/api-input";
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
    return NextResponse.json({ error: "Comic not found" }, { status: 404 });
  }

  const body = await readJsonObject(request);
  if (!body) {
    return NextResponse.json({ error: "Expected a valid JSON object" }, { status: 400 });
  }
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  if (!title) {
    return NextResponse.json({ error: "Chapter title is required" }, { status: 400 });
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
