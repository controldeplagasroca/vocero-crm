import { z } from "zod";
import { apiError, parseBody, withAuth } from "@/lib/api";
import { saveReminderSettings } from "@/server/reminders";

export const dynamic = "force-dynamic";

const putSchema = z.object({
  autoSend: z.boolean(),
  templateId: z.string().nullable(),
});

export const PUT = withAuth(async (session, req: Request) => {
  if (session.role !== "owner") {
    return apiError(403, "forbidden", "Solo el propietario puede cambiar Recordatorios");
  }
  const body = await parseBody(req, putSchema);
  if (!body.ok) return body.response;

  if (body.data.autoSend && !body.data.templateId) {
    return apiError(
      422,
      "missing_template",
      "Elige una plantilla antes de activar el envío automático"
    );
  }

  await saveReminderSettings(session.organizationId, body.data);
  return Response.json({ ok: true, settings: body.data });
});
