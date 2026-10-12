import { z } from "zod";
import { asc, eq } from "drizzle-orm";
import { apiError, parseBody } from "@/lib/api";
import { isCalendarConfigured } from "@/lib/env";
import { getDb, schema } from "@/lib/db";
import { scoped } from "@/lib/db/tenant";
import { colorParaTecnico, ultimos10 } from "@/lib/technician-label";
import { etiquetarTecnico } from "@/server/calendar";
import { resolveInstanceOrg } from "@/server/bot/auth";
import { requireOpsKey } from "@/server/ops-auth";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  /** Teléfono del técnico (el mismo que tiene en Vocero); lo más confiable para emparejarlo. */
  telefono: z.string().trim().max(40).optional(),
  /** Nombre del técnico en OPS; se usa si no hay teléfono o no coincide. Vacío = quitar. */
  nombre: z.string().trim().max(120).nullable().optional(),
});

/**
 * ROCA OPS asigna (o quita) el técnico de una cita. Vocero lo deja escrito en el
 * evento de Google Calendar: nombre en el título y la descripción, color propio y,
 * si el técnico existe aquí, su id para que se vea en la Agenda y el detalle.
 * Idempotente: repetir la misma asignación no cambia nada.
 */
export const POST = async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const denied = requireOpsKey(req);
  if (denied) return denied;
  if (!isCalendarConfigured()) {
    return apiError(503, "not_configured", "El calendario no está configurado");
  }
  const organizationId = await resolveInstanceOrg();
  if (!organizationId) return apiError(409, "no_org", "La instancia aún no tiene organización");

  const { id } = await ctx.params;
  const body = await parseBody(req, bodySchema);
  if (!body.ok) return body.response;
  const { telefono, nombre } = body.data;

  // Sin teléfono ni nombre = quitar al técnico.
  if (!telefono && !nombre) {
    await etiquetarTecnico(id, null);
    return Response.json({ ok: true, asignado: false });
  }

  const tecnicos = await getDb()
    .select()
    .from(schema.technician)
    .where(
      scoped(schema.technician.organizationId, organizationId, eq(schema.technician.active, true))
    )
    .orderBy(asc(schema.technician.createdAt), asc(schema.technician.id));

  const tel = ultimos10(telefono);
  const encontrado =
    (tel ? tecnicos.find((t) => ultimos10(t.phone) === tel) : undefined) ??
    (nombre
      ? tecnicos.find((t) => t.name.trim().toLowerCase() === nombre.trim().toLowerCase())
      : undefined);

  const nombreVisible = encontrado?.name ?? nombre ?? null;
  if (!nombreVisible) return apiError(422, "sin_nombre", "Falta el nombre del técnico");

  await etiquetarTecnico(id, {
    technicianId: encontrado?.id ?? null,
    name: nombreVisible,
    colorId: encontrado
      ? colorParaTecnico(
          encontrado.id,
          tecnicos.map((t) => t.id)
        )
      : null,
  });
  return Response.json({
    ok: true,
    asignado: true,
    emparejado: Boolean(encontrado),
    nombre: nombreVisible,
  });
};
