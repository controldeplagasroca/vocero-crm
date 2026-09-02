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
  /** Dirección del servicio — visible para el/los técnico(s) asignados. */
  address: string | null;
  /** Contacto de Vocero vinculado a esta cita, si se ligó al agendarla. */
  contactId: string | null;
  /** Técnicos asignados (ids de la tabla `technician`), 0 o más. */
  technicianIds: string[];
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
/** Ids de técnicos asignados, guardados como CSV — extendedProperties solo
 * acepta valores string, y un id de nanoid nunca trae comas. */
const TECHNICIAN_IDS_KEY = "technicianIds";
const CONTACT_ID_KEY = "contactId";
const ADDRESS_KEY = "address";

function readPrivateProps(
  ev: import("googleapis").calendar_v3.Schema$Event
): { address: string | null; contactId: string | null; technicianIds: string[] } {
  const props = ev.extendedProperties?.private ?? {};
  const rawTechnicianIds = props[TECHNICIAN_IDS_KEY];
  return {
    address: props[ADDRESS_KEY] ?? null,
    contactId: props[CONTACT_ID_KEY] ?? null,
    technicianIds: rawTechnicianIds ? rawTechnicianIds.split(",").filter(Boolean) : [],
  };
}

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
      ...readPrivateProps(ev),
    }));
}

export async function createEvent(input: {
  title: string;
  description?: string;
  start: Date;
  end: Date;
  address?: string;
  contactId?: string;
  technicianIds?: string[];
}): Promise<CalendarEvent> {
  const calendar = getClient();
  const privateProps: Record<string, string> = { [SOURCE_KEY]: SOURCE_VALUE };
  if (input.address) privateProps[ADDRESS_KEY] = input.address;
  if (input.contactId) privateProps[CONTACT_ID_KEY] = input.contactId;
  if (input.technicianIds?.length) {
    privateProps[TECHNICIAN_IDS_KEY] = input.technicianIds.join(",");
  }
  const res = await calendar.events.insert({
    calendarId: calendarId(),
    requestBody: {
      summary: input.title,
      description: input.description,
      start: { dateTime: input.start.toISOString() },
      end: { dateTime: input.end.toISOString() },
      extendedProperties: { private: privateProps },
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
    address: input.address ?? null,
    contactId: input.contactId ?? null,
    technicianIds: input.technicianIds ?? [],
  };
}

export async function deleteEvent(id: string): Promise<void> {
  const calendar = getClient();
  await calendar.events.delete({ calendarId: calendarId(), eventId: id });
}

/**
 * Reagendar: mueve una cita existente a un nuevo horario (`events.patch`) en
 * vez de borrarla y crear una nueva — conserva el mismo id de evento.
 * Funciona tanto sobre citas creadas aquí como sobre las que agendó Nea: es
 * el mismo calendario compartido, mover cualquier evento en él es una
 * operación legítima de agenda, no algo exclusivo de "lo que creó el CRM".
 */
export async function rescheduleEvent(
  id: string,
  input: { start: Date; end: Date }
): Promise<CalendarEvent> {
  const calendar = getClient();
  const res = await calendar.events.patch({
    calendarId: calendarId(),
    eventId: id,
    requestBody: {
      start: { dateTime: input.start.toISOString() },
      end: { dateTime: input.end.toISOString() },
    },
  });
  const ev = res.data;
  return {
    id: ev.id!,
    title: ev.summary ?? "(sin título)",
    description: ev.description ?? null,
    start: ev.start!.dateTime!,
    end: ev.end!.dateTime!,
    createdByNea: ev.extendedProperties?.private?.[SOURCE_KEY] !== SOURCE_VALUE,
    ...readPrivateProps(ev),
  };
}

/**
 * Asignar/desasignar técnico(s) a una cita ya existente, sin tocar su
 * horario — un `events.patch` separado de `rescheduleEvent` porque son
 * acciones distintas para quien las usa (reagendar vs. designar técnico).
 */
export async function assignTechnicians(
  id: string,
  technicianIds: string[]
): Promise<CalendarEvent> {
  const calendar = getClient();
  const current = await calendar.events.get({ calendarId: calendarId(), eventId: id });
  const privateProps = { ...(current.data.extendedProperties?.private ?? {}) };
  if (technicianIds.length > 0) {
    privateProps[TECHNICIAN_IDS_KEY] = technicianIds.join(",");
  } else {
    delete privateProps[TECHNICIAN_IDS_KEY];
  }
  const res = await calendar.events.patch({
    calendarId: calendarId(),
    eventId: id,
    requestBody: { extendedProperties: { private: privateProps } },
  });
  const ev = res.data;
  return {
    id: ev.id!,
    title: ev.summary ?? "(sin título)",
    description: ev.description ?? null,
    start: ev.start!.dateTime!,
    end: ev.end!.dateTime!,
    createdByNea: ev.extendedProperties?.private?.[SOURCE_KEY] !== SOURCE_VALUE,
    ...readPrivateProps(ev),
  };
}
