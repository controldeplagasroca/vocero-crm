import { apiError, withAuth } from "@/lib/api";
import { isCalendarConfigured } from "@/lib/env";
import { deleteEvent } from "@/server/calendar";

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
