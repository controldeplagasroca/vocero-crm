import { and, desc, eq, gte } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { newId } from "@/lib/db/ids";
import { getEnv } from "@/lib/env";
import { getOrCreateContact, getOrCreateConversation } from "@/server/inbox/ingest";
import { sendTemplate } from "@/server/whatsapp/templates";

/**
 * Recordatorios de servicio: roca-ops-backend es la fuente de verdad de qué
 * cliente está por vencer/vencido (next_treatment_date) — Vocero solo lo
 * consulta (secreto compartido, servicio-a-servicio) y manda el WhatsApp
 * usando su propia infraestructura de plantillas/conversaciones.
 */

export type ReminderClient = {
  clientId: string;
  fullName: string;
  phone: string;
  nextTreatmentDate: string | null;
  status: string;
};

export class RemindersNotConfiguredError extends Error {
  constructor() {
    super("Recordatorios no tiene configurado roca-ops-backend");
  }
}

export async function fetchDueClients(): Promise<{
  overdue: ReminderClient[];
  upcoming: ReminderClient[];
}> {
  const env = getEnv();
  if (!env.ROCA_OPS_BASE_URL || !env.REMINDERS_API_SECRET) {
    throw new RemindersNotConfiguredError();
  }
  const res = await fetch(`${env.ROCA_OPS_BASE_URL}/api/v1/reports/reminders`, {
    headers: { "X-Reminders-Secret": env.REMINDERS_API_SECRET },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`roca-ops-backend respondió ${res.status} en /reports/reminders`);
  }
  const data = (await res.json()) as {
    overdue_clients: Array<{
      client_id: string;
      full_name: string;
      phone: string;
      next_treatment_date: string | null;
      status: string;
    }>;
    upcoming_clients: Array<{
      client_id: string;
      full_name: string;
      phone: string;
      next_treatment_date: string | null;
      status: string;
    }>;
  };
  const map = (c: (typeof data.overdue_clients)[number]): ReminderClient => ({
    clientId: c.client_id,
    fullName: c.full_name,
    phone: c.phone,
    nextTreatmentDate: c.next_treatment_date,
    status: c.status,
  });
  return {
    overdue: data.overdue_clients.map(map),
    upcoming: data.upcoming_clients.map(map),
  };
}

/** Ajustes de Recordatorios: mismo mecanismo que la marca (organization.metadata). */
export type ReminderSettings = {
  autoSend: boolean;
  templateId: string | null;
};

const DEFAULT_SETTINGS: ReminderSettings = { autoSend: false, templateId: null };

function parseMetadata(metadata: string | null): Record<string, unknown> {
  if (!metadata) return {};
  try {
    const parsed = JSON.parse(metadata) as unknown;
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export async function getReminderSettings(organizationId: string): Promise<ReminderSettings> {
  const db = getDb();
  const rows = await db
    .select({ metadata: schema.organization.metadata })
    .from(schema.organization)
    .where(eq(schema.organization.id, organizationId))
    .limit(1);
  const meta = parseMetadata(rows[0]?.metadata ?? null);
  const r = meta.reminders as Partial<ReminderSettings> | undefined;
  return {
    autoSend: typeof r?.autoSend === "boolean" ? r.autoSend : DEFAULT_SETTINGS.autoSend,
    templateId: typeof r?.templateId === "string" ? r.templateId : DEFAULT_SETTINGS.templateId,
  };
}

export async function saveReminderSettings(
  organizationId: string,
  settings: ReminderSettings
): Promise<void> {
  const db = getDb();
  const rows = await db
    .select({ metadata: schema.organization.metadata })
    .from(schema.organization)
    .where(eq(schema.organization.id, organizationId))
    .limit(1);
  const meta = parseMetadata(rows[0]?.metadata ?? null);
  meta.reminders = settings;
  await db
    .update(schema.organization)
    .set({ metadata: JSON.stringify(meta) })
    .where(eq(schema.organization.id, organizationId));
}

/** true si a este cliente de roca-ops ya se le mandó un recordatorio en los últimos `withinDays`. */
export async function wasRecentlyReminded(
  organizationId: string,
  rocaClientId: string,
  withinDays = 3
): Promise<boolean> {
  const db = getDb();
  const since = new Date(Date.now() - withinDays * 24 * 60 * 60 * 1000);
  const rows = await db
    .select({ id: schema.reminderLog.id })
    .from(schema.reminderLog)
    .where(
      and(
        eq(schema.reminderLog.organizationId, organizationId),
        eq(schema.reminderLog.rocaClientId, rocaClientId),
        gte(schema.reminderLog.sentAt, since)
      )
    )
    .orderBy(desc(schema.reminderLog.sentAt))
    .limit(1);
  return rows.length > 0;
}

/**
 * Manda el recordatorio: crea/encuentra el contacto de Vocero por teléfono
 * (puede no existir todavía — el cliente vive en roca-ops, no aquí), abre su
 * conversación si hace falta, y manda la plantilla aprobada. Registra el
 * envío en `reminder_log` para no repetirlo antes de `withinDays` días.
 */
export async function sendReminderMessage(input: {
  organizationId: string;
  rocaClientId: string;
  phone: string;
  fullName: string;
  templateId: string;
  variables?: string[];
  sentBy: "manual" | "auto";
}): Promise<{ messageId: string }> {
  const { contact } = await getOrCreateContact(input.organizationId, input.phone, input.fullName);
  const conversation = await getOrCreateConversation(input.organizationId, contact.id);
  const result = await sendTemplate({
    organizationId: input.organizationId,
    conversationId: conversation.id,
    templateId: input.templateId,
    variables: input.variables,
  });

  const db = getDb();
  await db.insert(schema.reminderLog).values({
    id: newId("reminderLog"),
    organizationId: input.organizationId,
    rocaClientId: input.rocaClientId,
    sentBy: input.sentBy,
  });

  return result;
}
