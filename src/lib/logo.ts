import { sniffFaviconMime } from "./favicon";
import type { Branding } from "./branding";

/**
 * Logo del lateral/encabezado, white-label. A diferencia del favicon (que
 * siempre tiene un generado de respaldo), sin logo subido el lateral cae a la
 * inicial sobre el acento — el mismo respaldo que ya existía antes de este
 * campo — así que aquí no hace falta un SVG generado.
 */

export const LOGO_ASSET = "logo";

export const LOGO_MIMES = [
  "image/png",
  "image/svg+xml",
  "image/jpeg",
  "image/webp",
] as const;

/** 512 KB: un logo real pesa más que un favicon pero sigue siendo un ícono, no un archivo. */
export const MAX_LOGO_BYTES = 512 * 1024;

/** Reutiliza el mismo sniffing por bytes que el favicon — es detección de
 * formato de imagen genérica, no algo específico del favicon. */
export { sniffFaviconMime as sniffLogoMime };

export function logoCacheKey(branding: Branding): string {
  return branding.logo ? `u${branding.logo.version}` : "none";
}

export function logoHref(branding: Branding): string | null {
  if (!branding.logo) return null;
  return `/api/branding/logo?v=${logoCacheKey(branding)}`;
}
