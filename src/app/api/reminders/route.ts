import { desc, eq } from "drizzle-orm";
import { apiError, withAuth } from "@/lib/api";
import { getDb, schema } from "@/lib/db";
import { scoped } from "@/lib/db/tenant";
import { isRemindersConfigured } from "@/lib/env";
import { serializeTemplate } from "@/server/whatsapp/templates";
import { fetchDueClients, getReminderSettings } from "@/server/reminders";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (session) => {
  if (!isRemindersConfigured()) {
    return apiError(
      503,
      "not_configured",
      "Recordatorios no tiene configurado roca-ops-backend todavía"
    );
  }

  const db = getDb();
  const [due, settings, templates] = await Promise.all([
    fetchDueClients(),
    getReminderSettings(session.organizationId),
    db
      .select()
      .from(schema.template)
      .where(
        scoped(
          schema.template.organizationId,
          session.organizationId,
          eq(schema.template.status, "approved")
        )
      )
      .orderBy(desc(schema.template.createdAt)),
  ]);

  return Response.json({
    overdue: due.overdue,
    upcoming: due.upcoming,
    settings,
    approvedTemplates: templates.map(serializeTemplate),
  });
});
