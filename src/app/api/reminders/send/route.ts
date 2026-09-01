import { z } from "zod";
import { apiError, parseBody, withAuth } from "@/lib/api";
import { SendError } from "@/server/inbox/send";
import { sendReminderMessage } from "@/server/reminders";
import { TemplateError, templateErrorStatus } from "@/server/whatsapp/templates";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  clientId: z.string().min(1),
  phone: z.string().min(1),
  fullName: z.string().min(1),
  templateId: z.string().min(1),
  variables: z.array(z.string().trim().max(500)).max(10).optional(),
});

export const POST = withAuth(async (session, req: Request) => {
  const body = await parseBody(req, bodySchema);
  if (!body.ok) return body.response;

  try {
    const result = await sendReminderMessage({
      organizationId: session.organizationId,
      rocaClientId: body.data.clientId,
      phone: body.data.phone,
      fullName: body.data.fullName,
      templateId: body.data.templateId,
      variables: body.data.variables,
      sentBy: "manual",
    });
    return Response.json({ messageId: result.messageId });
  } catch (err) {
    if (err instanceof TemplateError) {
      return apiError(templateErrorStatus(err), err.code, err.message);
    }
    if (err instanceof SendError) {
      return apiError(403, err.code, err.message);
    }
    throw err;
  }
});
