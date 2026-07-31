import { prisma } from "@/lib/prisma";

export const DEFAULT_HEADER_LOGO = "/logo-mark.svg";
export const DEFAULT_HERO_LOGO = "/logo-mark.svg";

export async function getSiteSettings() {
  const settings = await prisma.siteSetting.findUnique({
    where: { id: "singleton" },
  });

  return {
    headerLogo: settings?.headerLogo || DEFAULT_HEADER_LOGO,
    heroLogo: settings?.heroLogo || DEFAULT_HERO_LOGO,
    isHeaderLogoCustom: Boolean(settings?.headerLogo),
    isHeroLogoCustom: Boolean(settings?.heroLogo),
  };
}
