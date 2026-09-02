import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { scoped } from "@/lib/db/tenant";
import { effectiveSource } from "@/server/contact-source";
import { upsertFicha } from "@/server/bot/ficha";
import { DIRECCION_FICHA_KEY } from "@/lib/ficha";
import type { FichaDto, PriorityValue } from "@/lib/types";

export function serializeContact(
  c: typeof schema.contact.$inferSelect,
  stageName: string | null = null,
  priority: PriorityValue | null = null
) {
  return {
    id: c.id,
    name: c.name,
    phone: c.phone,
    notes: c.notes,
    stageName,
    archivedAt: c.archivedAt?.toISOString() ?? null,
    source: effectiveSource(c.source),
    priority,
    // Viaja siempre, aunque esté vacía: la pantalla necesita distinguir "aún
    // no la han llenado" de "este contacto no la trae".
    ficha: (c.ficha as FichaDto | null) ?? {},
  };
}

export async function getContactById(
  organizationId: string,
  contactId: string
) {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.contact)
    .where(
      scoped(
        schema.contact.organizationId,
        organizationId,
        eq(schema.contact.id, contactId)
      )
    )
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Completa la dirección del contacto a partir de una cita agendada —
 * ÚNICAMENTE si el contacto todavía no tiene una. Nunca pisa una dirección
 * que ya se sabía (pudo corregirse a mano y ser más precisa que la de una
 * cita puntual). No falla el agendado si el contacto no existe o la
 * organización no coincide: es un beneficio adicional, no un requisito.
 */
export async function backfillContactAddress(
  organizationId: string,
  contactId: string,
  address: string
): Promise<void> {
  const contact = await getContactById(organizationId, contactId);
  if (!contact) return;
  const ficha = (contact.ficha as FichaDto | null) ?? {};
  if (ficha[DIRECCION_FICHA_KEY]) return;
  await upsertFicha({
    organizationId,
    contactId,
    ficha: { [DIRECCION_FICHA_KEY]: address },
  });
}

/** Etapa actual del lead del contacto (si existe). */
export async function getContactStage(
  organizationId: string,
  contactId: string
) {
  const db = getDb();
  const rows = await db
    .select({ stage: schema.pipelineStage, lead: schema.lead })
    .from(schema.lead)
    .innerJoin(
      schema.pipelineStage,
      eq(schema.lead.stageId, schema.pipelineStage.id)
    )
    .where(
      scoped(
        schema.lead.organizationId,
        organizationId,
        eq(schema.lead.contactId, contactId)
      )
    )
    .limit(1);
  return rows[0] ?? null;
}
