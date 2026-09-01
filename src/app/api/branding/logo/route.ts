import { readMediaFile } from "@/server/whatsapp/media";
import { getBrandingContext } from "@/server/branding";

export const dynamic = "force-dynamic";

/**
 * Sirve el logo del lateral. Público como `/api/branding/favicon`: el login
 * también pinta la marca antes de que exista una sesión. A diferencia del
 * favicon, sin logo subido no hay nada que generar — la UI cae a la inicial
 * sobre el acento por su cuenta — así que aquí sí corresponde un 404 real.
 */
export async function GET(req: Request) {
  const cacheable = new URL(req.url).searchParams.has("v");

  const ctx = await getBrandingContext().catch(() => null);
  if (!ctx?.organizationId || !ctx.branding.logo) {
    return new Response(null, { status: 404 });
  }

  try {
    const buf = await readMediaFile(ctx.organizationId, "logo");
    return new Response(new Uint8Array(buf), {
      headers: {
        "content-type": ctx.branding.logo.mime,
        "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'",
        "x-content-type-options": "nosniff",
        "cache-control": cacheable
          ? "public, max-age=31536000, immutable"
          : "public, max-age=60",
      },
    });
  } catch {
    // Archivo perdido (volumen sin montar, restauración a medias): la UI ya
    // cae a la inicial cuando este endpoint no responde 200.
    return new Response(null, { status: 404 });
  }
}
