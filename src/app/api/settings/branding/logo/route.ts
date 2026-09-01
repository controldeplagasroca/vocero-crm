import { rm } from "node:fs/promises";
import { apiError, withAuth } from "@/lib/api";
import { LOGO_ASSET, MAX_LOGO_BYTES, sniffLogoMime } from "@/lib/logo";
import { getBranding, saveBranding } from "@/server/branding";
import { mediaFilePath, saveMediaFile } from "@/server/whatsapp/media";

export const dynamic = "force-dynamic";

/**
 * Subir el logo del lateral. Mismo patrón que
 * `/api/settings/branding/favicon`: cuerpo crudo con su `content-type`, sin
 * multipart.
 */
export const PUT = withAuth(async (session, req: Request) => {
  if (session.role !== "owner") {
    return apiError(403, "forbidden", "Solo el propietario puede cambiar la marca");
  }

  const buf = new Uint8Array(await req.arrayBuffer());
  if (buf.byteLength === 0) {
    return apiError(422, "empty", "No llegó ningún archivo");
  }
  if (buf.byteLength > MAX_LOGO_BYTES) {
    return apiError(
      413,
      "too_large",
      `El logo no puede pasar de ${Math.round(MAX_LOGO_BYTES / 1024)} KB`
    );
  }

  // El tipo sale de los bytes, no de lo que declare el cliente — misma razón
  // que el favicon: esto se sirve desde el mismo dominio.
  const mime = sniffLogoMime(buf);
  if (!mime) {
    return apiError(
      422,
      "unsupported",
      "Formato no reconocido. Usa PNG, SVG, JPEG o WebP."
    );
  }

  await saveMediaFile(session.organizationId, LOGO_ASSET, buf);

  const branding = await getBranding(session.organizationId);
  const version = Date.now();
  await saveBranding(session.organizationId, {
    ...branding,
    logo: { mime, version },
  });

  return Response.json({ logo: { mime, version } });
});

/** Quitar el logo subido y volver a la inicial sobre el acento. */
export const DELETE = withAuth(async (session) => {
  if (session.role !== "owner") {
    return apiError(403, "forbidden", "Solo el propietario puede cambiar la marca");
  }

  const branding = await getBranding(session.organizationId);
  await saveBranding(session.organizationId, { ...branding, logo: null });
  await rm(mediaFilePath(session.organizationId, LOGO_ASSET), {
    force: true,
  }).catch(() => null);

  return Response.json({ logo: null });
});
