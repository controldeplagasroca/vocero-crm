import { timingSafeEqual } from "node:crypto";
import { apiError } from "@/lib/api";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * Autenticación de `/api/external/leads` — la superficie que consume
 * automatización externa (n8n u otro orquestador) para dar de alta un
 * prospecto capturado fuera del CRM (formulario del sitio web, etc.) y,
 * opcionalmente, disparar la plantilla de bienvenida.
 *
 * Deliberadamente SEPARADA de `BOT_API_KEY` (esa es para el cerebro
 * conversacional; esta es para la ingesta de leads) — un secreto filtrado en
 * una no compromete a la otra. Mismo patrón: header `X-API-Key`, comparación
 * en tiempo constante, sin la env var toda la superficie responde 401.
 */
export function requireIntakeKey(req: Request): Response | null {
  const rl = checkRateLimit("leads-intake-api", { windowMs: 60_000, max: 120 });
  if (!rl.allowed) return apiError(429, "rate_limited", "Demasiadas solicitudes");

  const expected = process.env.LEAD_INTAKE_API_KEY;
  const provided = req.headers.get("x-api-key");
  if (!expected || expected.length < 16 || !provided) {
    return apiError(401, "unauthorized", "No autorizado");
  }
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return apiError(401, "unauthorized", "No autorizado");
  }
  return null;
}
