import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { apiError, parseBody } from "@/lib/api";
import { getDb, schema } from "@/lib/db";
import { newId } from "@/lib/db/ids";
import { scoped } from "@/lib/db/tenant";
import { normalizeMx } from "@/lib/meta/client";
import { resolveInstanceOrg } from "@/server/bot/auth";
import { serializeContact } from "@/server/contacts";
import { createLeadForContact } from "@/server/inbox/lead-activity";
import { getOrCreateConversation } from "@/server/inbox/ingest";
import { isWindowOpen } from "@/server/inbox/window";
import { requireIntakeKey } from "@/server/leads/intake-auth";
import {
  sendTemplate,
  TemplateError,
  templateErrorStatus,
} from "@/server/whatsapp/templates";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z
    .string()
    .trim()
    .regex(/^\d{7,15}$/, "Teléfono en dígitos, con código de país (ej. 5215512345678)"),
  notes: z.string().max(4000).optional(),
  source: z.enum(["anuncio", "organico", "referido", "conocido", "otro"]).optional(),
  // Si se manda, se intenta disparar la plantilla de bienvenida tras crear/
  // encontrar el contacto — mismo comportamiento que "Iniciar conversación"
  // en la UI, pero de un solo golpe para no obligar a n8n a dos llamadas.
  template: z
    .object({
      id: z.string().min(1),
      variables: z.array(z.string().trim().max(500)).max(10).optional(),
    })
    .optional(),
});

/**
 * Ingesta de leads capturados FUERA del CRM (formulario del sitio web vía
 * n8n, u otro orquestador). Crea el contacto + su lead en el pipeline como lo
 * haría el dueño a mano, y opcionalmente manda la plantilla de bienvenida —
 * todo protegido por API key (`requireIntakeKey`), no por sesión de
 * navegador, porque quien llama es una automatización, no una persona.
 *
 * Idempotente en el teléfono: un reintento de n8n (o un doble submit del
 * formulario) reutiliza el contacto existente en vez de fallar con 409.
 */
export const POST = async (req: Request) => {
  const denied = requireIntakeKey(req);
  if (denied) return denied;

  const organizationId = await resolveInstanceOrg();
  if (!organizationId) {
    return apiError(409, "no_org", "La instancia aún no tiene organización");
  }

  const body = await parseBody(req, bodySchema);
  if (!body.ok) return body.response;

  const db = getDb();
  const phone = normalizeMx(body.data.phone);

  const inserted = await db
    .insert(schema.contact)
    .values({
      id: newId("contact"),
      organizationId,
      name: body.data.name,
      phone,
      waIdentity: phone,
      notes: body.data.notes ?? null,
      source: body.data.source ?? "organico",
    })
    .onConflictDoNothing({
      target: [schema.contact.organizationId, schema.contact.waIdentity],
    })
    .returning();

  let contact = inserted[0];
  let isNewContact = true;
  if (!contact) {
    isNewContact = false;
    const existing = await db
      .select()
      .from(schema.contact)
      .where(
        scoped(
          schema.contact.organizationId,
          organizationId,
          eq(schema.contact.waIdentity, phone)
        )
      )
      .limit(1);
    if (!existing[0]) {
      return apiError(500, "internal", "No se pudo crear ni recuperar el contacto");
    }
    contact = existing[0];
  }

  const lead = isNewContact
    ? await createLeadForContact({
        organizationId,
        contactId: contact.id,
        source: "sistema",
      })
    : null;

  let templateResult:
    | { messageId: string }
    | { skipped: "window_open" | "no_identity" | string }
    | null = null;

  if (body.data.template) {
    if (!contact.phone && !contact.waIdentity) {
      templateResult = { skipped: "no_identity" };
    } else {
      const existingConv = await db
        .select({
          id: schema.conversation.id,
          lastInboundAt: schema.conversation.lastInboundAt,
        })
        .from(schema.conversation)
        .where(
          and(
            eq(schema.conversation.organizationId, organizationId),
            eq(schema.conversation.contactId, contact.id),
            eq(schema.conversation.isTest, false)
          )
        )
        .limit(1);

      if (existingConv[0] && isWindowOpen(existingConv[0].lastInboundAt)) {
        // Igual que "Iniciar conversación" en la UI: con la ventana de 24h
        // abierta, mandar plantilla es gastar dinero y reputación por nada.
        templateResult = { skipped: "window_open" };
      } else {
        const conversation =
          existingConv[0] ?? (await getOrCreateConversation(organizationId, contact.id));
        try {
          const result = await sendTemplate({
            organizationId,
            conversationId: conversation.id,
            templateId: body.data.template.id,
            variables: body.data.template.variables,
          });
          templateResult = result;
        } catch (err) {
          if (err instanceof TemplateError) {
            return apiError(templateErrorStatus(err), err.code, err.message);
          }
          throw err;
        }
      }
    }
  }

  return Response.json(
    {
      contact: serializeContact(contact),
      lead: lead ? { id: lead.id } : null,
      isNewContact,
      template: templateResult,
    },
    { status: isNewContact ? 201 : 200 }
  );
};
