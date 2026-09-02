import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { apiError, parseBody, withAuth } from "@/lib/api";
import { getDb, schema } from "@/lib/db";
import { newId } from "@/lib/db/ids";
import { scoped } from "@/lib/db/tenant";

export const dynamic = "force-dynamic";

/** Catálogo de técnicos de la instancia, para asignarlos a citas del Agendamiento. */
export const GET = withAuth(async (session) => {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.technician)
    .where(scoped(schema.technician.organizationId, session.organizationId))
    .orderBy(schema.technician.name);
  return Response.json({
    technicians: rows.map((t) => ({
      id: t.id,
      name: t.name,
      phone: t.phone,
      active: t.active,
    })),
  });
});

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(30).optional(),
});

export const POST = withAuth(async (session, req: Request) => {
  const body = await parseBody(req, createSchema);
  if (!body.ok) return body.response;

  const db = getDb();
  const inserted = await db
    .insert(schema.technician)
    .values({
      id: newId("technician"),
      organizationId: session.organizationId,
      name: body.data.name,
      phone: body.data.phone || null,
    })
    .returning();

  const t = inserted[0];
  if (!t) return apiError(500, "internal", "No se pudo crear el técnico");
  return Response.json(
    { technician: { id: t.id, name: t.name, phone: t.phone, active: t.active } },
    { status: 201 }
  );
});

const patchSchema = z.object({
  id: z.string().min(1),
  active: z.boolean().optional(),
  name: z.string().trim().min(1).max(120).optional(),
  phone: z.string().trim().max(30).nullable().optional(),
});

/** Desactivar/editar un técnico. No se borra (las citas pasadas conservan su nombre). */
export const PATCH = withAuth(async (session, req: Request) => {
  const body = await parseBody(req, patchSchema);
  if (!body.ok) return body.response;

  const set: Record<string, unknown> = {};
  if (body.data.active !== undefined) set.active = body.data.active;
  if (body.data.name !== undefined) set.name = body.data.name;
  if (body.data.phone !== undefined) set.phone = body.data.phone;
  if (Object.keys(set).length === 0) {
    return apiError(422, "invalid_body", "Nada que actualizar");
  }

  const db = getDb();
  const updated = await db
    .update(schema.technician)
    .set(set)
    .where(
      and(
        eq(schema.technician.id, body.data.id),
        eq(schema.technician.organizationId, session.organizationId)
      )
    )
    .returning();
  if (!updated[0]) return apiError(404, "not_found", "Técnico no encontrado");
  const t = updated[0];
  return Response.json({ technician: { id: t.id, name: t.name, phone: t.phone, active: t.active } });
});
