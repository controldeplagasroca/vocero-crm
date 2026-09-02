import { z } from "zod";
import { apiError, parseBody, withAuth } from "@/lib/api";
import { isCalendarConfigured } from "@/lib/env";
import { assignTechnicians } from "@/server/calendar";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  technicianIds: z.array(z.string().min(1)).max(10),
});

/** Designar (o quitar) técnico(s) de una cita, sin tocar su horario. */
export const PATCH = withAuth(
  async (_session, req: Request, ctx: { params: Promise<{ id: string }> }) => {
    if (!isCalendarConfigured()) {
      return apiError(
        503,
        "not_configured",
        "El Agendamiento no tiene configurado Google Calendar todavía"
      );
    }
    const body = await parseBody(req, patchSchema);
    if (!body.ok) return body.response;

    const { id } = await ctx.params;
    const event = await assignTechnicians(id, body.data.technicianIds);
    return Response.json({ event });
  }
);
