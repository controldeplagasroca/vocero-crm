import { timingSafeEqual } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { apiError } from "@/lib/api";
import { getDb, schema } from "@/lib/db";
import { scoped } from "@/lib/db/tenant";
import { getEnv, isRemindersConfigured } from "@/lib/env";
import { resolveInstanceOrg } from "@/server/bot/auth";
import {
  fetchDueClients,
  getReminderSettings,
  sendReminderMessage,
  wasRecentlyReminded,
} from "@/server/reminders";

export const dynamic = "force-dynamic";

/**
 * Disparado por una tarea programada del VPS (crontab), una vez al día — no
 * hay cron dentro de Next.js. Header `X-Cron-Secret` contra
 * `REMINDERS_CRON_SECRET`, comparación en tiempo constante, igual que
 * `requireBotKey` para `/api/bot/*`. Si "Automático" está apagado en
 * Ajustes, no manda nada (sigue existiendo el botón manual).
 */
function requireCronSecret(req: Request): Response | null {
  const expected = getEnv().REMINDERS_CRON_SECRET;
  const provided = req.headers.get("x-cron-secret");
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

export async function POST(req: Request) {
  const denied = requireCronSecret(req);
  if (denied) return denied;

  if (!isRemindersConfigured()) {
    return apiError(503, "not_configured", "Recordatorios no tiene configurado roca-ops-backend");
  }

  const organizationId = await resolveInstanceOrg();
  if (!organizationId) {
    return apiError(409, "no_org", "La instancia aún no tiene organización");
  }

  const settings = await getReminderSettings(organizationId);
  if (!settings.autoSend || !settings.templateId) {
    return Response.json({ ran: false, reason: "auto_send_disabled" });
  }

  const db = getDb();
  const templates = await db
    .select()
    .from(schema.template)
    .where(
      scoped(
        schema.template.organizationId,
        organizationId,
        eq(schema.template.id, settings.templateId),
        eq(schema.template.status, "approved")
      )
    )
    .orderBy(desc(schema.template.createdAt))
    .limit(1);
  if (!templates[0]) {
    return Response.json({ ran: false, reason: "template_not_approved" });
  }

  const { overdue, upcoming } = await fetchDueClients();
  const results: Array<{ clientId: string; sent: boolean; reason?: string }> = [];

  for (const client of [...overdue, ...upcoming]) {
    if (await wasRecentlyReminded(organizationId, client.clientId)) {
      results.push({ clientId: client.clientId, sent: false, reason: "recently_reminded" });
      continue;
    }
    try {
      await sendReminderMessage({
        organizationId,
        rocaClientId: client.clientId,
        phone: client.phone,
        fullName: client.fullName,
        templateId: settings.templateId,
        variables: [client.fullName],
        sentBy: "auto",
      });
      results.push({ clientId: client.clientId, sent: true });
    } catch (err) {
      results.push({
        clientId: client.clientId,
        sent: false,
        reason: err instanceof Error ? err.message : "error",
      });
    }
  }

  return Response.json({ ran: true, results });
}
