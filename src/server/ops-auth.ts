import { timingSafeEqual } from "node:crypto";
import { apiError } from "@/lib/api";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * Autenticación de lo que ROCA OPS le manda a Vocero (hoy: qué técnico quedó
 * asignado a una cita). Secreto propio (`OPS_API_KEY`), separado del de leads y
 * del del bot: uno filtrado no compromete a los demás. Sin la variable, 401.
 */
export function requireOpsKey(req: Request): Response | null {
  const rl = checkRateLimit("ops-api", { windowMs: 60_000, max: 120 });
  if (!rl.allowed) return apiError(429, "rate_limited", "Demasiadas solicitudes");

  const expected = process.env.OPS_API_KEY;
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
