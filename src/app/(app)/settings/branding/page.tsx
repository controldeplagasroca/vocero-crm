import { BrandingClient } from "@/components/settings/branding-client";
import { FaviconCard } from "@/components/settings/favicon-card";
import { LogoCard } from "@/components/settings/logo-card";
import { getBranding } from "@/server/branding";
import { getSessionOrNull } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function BrandingSettingsPage() {
  // La marca se lee en el servidor para que las tarjetas de icono/logo ya
  // pinten la vista previa correcta en el primer render, sin un parpadeo del
  // generado al subido mientras un fetch del cliente va y vuelve.
  const session = await getSessionOrNull();
  const branding = await getBranding(session?.organizationId);

  return (
    <div className="max-w-2xl space-y-6">
      <BrandingClient />
      <LogoCard branding={branding} />
      <FaviconCard branding={branding} />
    </div>
  );
}
