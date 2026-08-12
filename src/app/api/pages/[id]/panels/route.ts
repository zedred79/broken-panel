import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";

type PointInput = { x: number; y: number };

export async function GET(
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
    include: { panels: { orderBy: { order: "asc" } } },
  });

  if (!page) {
    return NextResponse.json({ error: "Page not found" }, { status: 404 });
  }

  return NextResponse.json({
    page: {
      ...page,
      panels: page.panels.map((panel) => ({
        id: panel.id,
        order: panel.order,
        points: JSON.parse(panel.points) as PointInput[],
      })),
    },
  });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const panels = body?.panels;

  if (!Array.isArray(panels)) {
    return NextResponse.json({ error: "Invalid panels" }, { status: 400 });
  }

  for (const panel of panels) {
    if (
      !Array.isArray(panel.points) ||
      panel.points.length < 3 ||
      !panel.points.every(
        (pt: PointInput) =>
          typeof pt?.x === "number" &&
          typeof pt?.y === "number" &&
          pt.x >= 0 &&
          pt.x <= 100 &&
          pt.y >= 0 &&
          pt.y <= 100
      )
    ) {
      return NextResponse.json(
        { error: "Each panel requires at least 3 valid points (0-100)" },
        { status: 400 }
      );
    }
  }

  const page = await prisma.page.findUnique({ where: { id } });
  if (!page) {
    return NextResponse.json({ error: "Page not found" }, { status: 404 });
  }

  await prisma.$transaction([
    prisma.panel.deleteMany({ where: { pageId: id } }),
    ...panels.map((panel: { points: PointInput[] }, index: number) =>
      prisma.panel.create({
        data: {
          pageId: id,
          order: index,
          points: JSON.stringify(panel.points),
        },
      })
    ),
  ]);

  return NextResponse.json({ ok: true });
}
