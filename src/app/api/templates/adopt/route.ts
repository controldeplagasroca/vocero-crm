import { z } from "zod";
import { apiError, parseBody, withAuth } from "@/lib/api";
import {
  adoptTemplate,
  serializeTemplate,
  TemplateError,
  templateErrorStatus,
} from "@/server/whatsapp/templates";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  name: z.string().trim().min(1).max(60),
  language: z.string().trim().min(2).max(10),
  category: z.enum(["UTILITY", "MARKETING"]),
  body: z.string().trim().min(1).max(1024),
});

/**
 * Adopta una plantilla que YA está aprobada en Meta (creada fuera del CRM,
 * ej. directo en WhatsApp Manager) sin volver a mandarla a aprobación. Nombre
 * + idioma deben coincidir EXACTO con la plantilla real en Meta — es lo que
 * usa `syncTemplates` para encontrarla y traer su estado real.
 */
export const POST = withAuth(async (session, req: Request) => {
  const body = await parseBody(req, bodySchema);
  if (!body.ok) return body.response;

  try {
    const template = await adoptTemplate(session.organizationId, body.data);
    return Response.json({ template: serializeTemplate(template) }, { status: 201 });
  } catch (err) {
    if (err instanceof TemplateError) {
      return apiError(templateErrorStatus(err), err.code, err.message);
    }
    throw err;
  }
});
