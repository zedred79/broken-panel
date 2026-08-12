import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { deleteUploadedFile, saveLogoImage } from "@/lib/uploads";
import { DEFAULT_HEADER_LOGO, DEFAULT_HERO_LOGO } from "@/lib/site-settings";

export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await prisma.siteSetting.findUnique({
    where: { id: "singleton" },
  });

  return NextResponse.json({
    headerLogo: settings?.headerLogo ?? null,
    heroLogo: settings?.heroLogo ?? null,
    defaultHeaderLogo: DEFAULT_HEADER_LOGO,
    defaultHeroLogo: DEFAULT_HERO_LOGO,
  });
}

export async function PUT(request: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const headerLogoFile = formData.get("headerLogo");
  const heroLogoFile = formData.get("heroLogo");
  const clearHeaderLogo = formData.get("clearHeaderLogo") === "true";
  const clearHeroLogo = formData.get("clearHeroLogo") === "true";

  const data: { headerLogo?: string | null; heroLogo?: string | null } = {};

  try {
    if (headerLogoFile instanceof File && headerLogoFile.size > 0) {
      data.headerLogo = await saveLogoImage(headerLogoFile);
    } else if (clearHeaderLogo) {
      data.headerLogo = null;
    }

    if (heroLogoFile instanceof File && heroLogoFile.size > 0) {
      data.heroLogo = await saveLogoImage(heroLogoFile);
    } else if (clearHeroLogo) {
      data.heroLogo = null;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload error";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const previous = await prisma.siteSetting.findUnique({
    where: { id: "singleton" },
  });

  const settings = await prisma.siteSetting.upsert({
    where: { id: "singleton" },
    update: data,
    create: { id: "singleton", ...data },
  });

  await Promise.all([
    "headerLogo" in data && previous?.headerLogo !== data.headerLogo
      ? deleteUploadedFile(previous?.headerLogo)
      : Promise.resolve(),
    "heroLogo" in data && previous?.heroLogo !== data.heroLogo
      ? deleteUploadedFile(previous?.heroLogo)
      : Promise.resolve(),
  ]);

  return NextResponse.json({
    headerLogo: settings.headerLogo,
    heroLogo: settings.heroLogo,
  });
}
