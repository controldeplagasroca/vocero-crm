import { google } from "googleapis";
import { getEnv, isCalendarConfigured } from "@/lib/env";

/**
 * Agendamiento: lee y escribe sobre el MISMO Google Calendar que ya usa Nea
 * (nea-agent/app/gcal.py), con la misma cuenta de servicio. A propósito no
 * hay una tabla de citas propia en la BD de este CRM: vocero-crm deja el
 * motor de agendamiento fuera de alcance (ver su propio README/issue #8) —
 * el estado de qué huecos existen pertenece al calendario compartido, no a
 * un segundo origen de verdad que podría desincronizarse de lo que Nea ya
 * agendó.
 */

export type CalendarEvent = {
  id: string;
  title: string;
  description: string | null;
  start: string; // ISO 8601
  end: string; // ISO 8601
  createdByNea: boolean;
};

class CalendarNotConfiguredError extends Error {
  constructor() {
    super("El Agendamiento no tiene configurado Google Calendar");
  }
}

let cachedClient: ReturnType<typeof google.calendar> | null = null;

function getClient() {
  if (cachedClient) return cachedClient;
  if (!isCalendarConfigured()) throw new CalendarNotConfiguredError();
  const env = getEnv();
  const credentials = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON!) as {
    client_email: string;
    private_key: string;
  };
  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ["https://www.googleapis.com/auth/calendar"],
  });
  cachedClient = google.calendar({ version: "v3", auth });
  return cachedClient;
}

function calendarId(): string {
  return getEnv().GOOGLE_CALENDAR_ID!;
}

/**
 * `extendedProperties.private.source` distingue una cita creada a mano desde
 * este CRM de una agendada por Nea — ambas viven en el mismo calendario, pero
 * la UI quiere poder marcar cuál es cuál sin adivinar por el texto.
 */
const SOURCE_KEY = "source";
const SOURCE_VALUE = "vocero-crm";

export { CalendarNotConfiguredError };

export async function listUpcomingEvents(opts: {
  timeMin: Date;
  timeMax: Date;
}): Promise<CalendarEvent[]> {
  const calendar = getClient();
  const res = await calendar.events.list({
    calendarId: calendarId(),
    timeMin: opts.timeMin.toISOString(),
    timeMax: opts.timeMax.toISOString(),
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 250,
  });
  return (res.data.items ?? [])
    .filter((ev) => ev.id && ev.start?.dateTime && ev.end?.dateTime)
    .map((ev) => ({
      id: ev.id!,
      title: ev.summary ?? "(sin título)",
      description: ev.description ?? null,
      start: ev.start!.dateTime!,
      end: ev.end!.dateTime!,
      createdByNea: ev.extendedProperties?.private?.[SOURCE_KEY] !== SOURCE_VALUE,
    }));
}

export async function createEvent(input: {
  title: string;
  description?: string;
  start: Date;
  end: Date;
}): Promise<CalendarEvent> {
  const calendar = getClient();
  const res = await calendar.events.insert({
    calendarId: calendarId(),
    requestBody: {
      summary: input.title,
      description: input.description,
      start: { dateTime: input.start.toISOString() },
      end: { dateTime: input.end.toISOString() },
      extendedProperties: { private: { [SOURCE_KEY]: SOURCE_VALUE } },
    },
  });
  const ev = res.data;
  return {
    id: ev.id!,
    title: ev.summary ?? input.title,
    description: ev.description ?? null,
    start: ev.start!.dateTime!,
    end: ev.end!.dateTime!,
    createdByNea: false,
  };
}

export async function deleteEvent(id: string): Promise<void> {
  const calendar = getClient();
  await calendar.events.delete({ calendarId: calendarId(), eventId: id });
}
