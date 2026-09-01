import { z } from "zod";
import { apiError, parseBody, withAuth } from "@/lib/api";
import { isCalendarConfigured } from "@/lib/env";
import { deleteEvent, rescheduleEvent } from "@/server/calendar";

export const dynamic = "force-dynamic";

export const DELETE = withAuth(
  async (_session, _req: Request, ctx: { params: Promise<{ id: string }> }) => {
    if (!isCalendarConfigured()) {
      return apiError(
        503,
        "not_configured",
        "El Agendamiento no tiene configurado Google Calendar todavía"
      );
    }
    const { id } = await ctx.params;
    await deleteEvent(id);
    return Response.json({ ok: true });
  }
);

const patchSchema = z.object({
  start: z.string().datetime(),
  end: z.string().datetime(),
});

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

    const start = new Date(body.data.start);
    const end = new Date(body.data.end);
    if (end <= start) {
      return apiError(422, "invalid_range", "La hora de fin debe ser después del inicio");
    }

    const { id } = await ctx.params;
    const event = await rescheduleEvent(id, { start, end });
    return Response.json({ event });
  }
);
