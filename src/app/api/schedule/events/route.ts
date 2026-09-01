import { z } from "zod";
import { apiError, parseBody, withAuth } from "@/lib/api";
import { isCalendarConfigured } from "@/lib/env";
import { createEvent, listUpcomingEvents } from "@/server/calendar";

export const dynamic = "force-dynamic";

/** Rango por defecto: 14 días atrás a 60 días adelante — suficiente para ver
 * lo reciente y lo agendado a futuro sin paginar. */
function defaultRange() {
  const now = new Date();
  const timeMin = new Date(now);
  timeMin.setDate(timeMin.getDate() - 14);
  const timeMax = new Date(now);
  timeMax.setDate(timeMax.getDate() + 60);
  return { timeMin, timeMax };
}

export const GET = withAuth(async () => {
  if (!isCalendarConfigured()) {
    return apiError(
      503,
      "not_configured",
      "El Agendamiento no tiene configurado Google Calendar todavía"
    );
  }
  const { timeMin, timeMax } = defaultRange();
  const events = await listUpcomingEvents({ timeMin, timeMax });
  return Response.json({ events });
});

const postSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  start: z.string().datetime(),
  end: z.string().datetime(),
});

export const POST = withAuth(async (_session, req: Request) => {
  if (!isCalendarConfigured()) {
    return apiError(
      503,
      "not_configured",
      "El Agendamiento no tiene configurado Google Calendar todavía"
    );
  }
  const body = await parseBody(req, postSchema);
  if (!body.ok) return body.response;

  const start = new Date(body.data.start);
  const end = new Date(body.data.end);
  if (end <= start) {
    return apiError(422, "invalid_range", "La hora de fin debe ser después del inicio");
  }

  const event = await createEvent({
    title: body.data.title,
    description: body.data.description,
    start,
    end,
  });
  return Response.json({ event });
});
