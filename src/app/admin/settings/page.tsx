import { prisma } from "@/lib/prisma";
import { SiteSettingsForm } from "@/components/admin/SiteSettingsForm";
import { ChangePasswordForm } from "@/components/admin/ChangePasswordForm";
import { DEFAULT_HEADER_LOGO, DEFAULT_HERO_LOGO } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

export default async function SiteSettingsPage() {
  const settings = await prisma.siteSetting.findUnique({
    where: { id: "singleton" },
  });

  return (
    <div>
      <h1 className="font-display mb-2 text-3xl tracking-wide">
        Impostazioni sito
      </h1>
      <p className="mb-8 text-sm text-muted">
        Personalizza i loghi mostrati sul sito pubblico.
      </p>

      <SiteSettingsForm
        initial={{
          headerLogo: settings?.headerLogo ?? null,
          heroLogo: settings?.heroLogo ?? null,
          defaultHeaderLogo: DEFAULT_HEADER_LOGO,
          defaultHeroLogo: DEFAULT_HERO_LOGO,
        }}
      />

      <div className="mt-10">
        <ChangePasswordForm />
      </div>
    </div>
  );
}
