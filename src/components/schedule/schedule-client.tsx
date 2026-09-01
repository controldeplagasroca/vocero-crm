"use client";

import { useEffect, useState } from "react";
import { CalendarClock, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NewAppointmentDialog } from "@/components/schedule/new-appointment-dialog";
import { RescheduleDialog } from "@/components/schedule/reschedule-dialog";

type EventDto = {
  id: string;
  title: string;
  description: string | null;
  start: string;
  end: string;
  createdByNea: boolean;
};

const DAY_LABEL = new Intl.DateTimeFormat("es-MX", {
  weekday: "long",
  day: "numeric",
  month: "long",
}).format;
const TIME_LABEL = new Intl.DateTimeFormat("es-MX", {
  hour: "numeric",
  minute: "2-digit",
}).format;

function groupByDay(events: EventDto[]): [string, EventDto[]][] {
  const groups = new Map<string, EventDto[]>();
  for (const ev of events) {
    const key = new Date(ev.start).toDateString();
    groups.set(key, [...(groups.get(key) ?? []), ev]);
  }
  return [...groups.entries()];
}

export function ScheduleClient() {
  const [events, setEvents] = useState<EventDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [rescheduling, setRescheduling] = useState<EventDto | null>(null);

  async function refetch() {
    setError(null);
    const res = await fetch("/api/schedule/events").catch(() => null);
    if (!res) {
      setError("No se pudo conectar con el servidor.");
      return;
    }
    if (res.status === 503) {
      setNotConfigured(true);
      return;
    }
    if (!res.ok) {
      setError("No se pudieron cargar las citas.");
      return;
    }
    const data = (await res.json()) as { events: EventDto[] };
    setEvents(data.events);
  }

  useEffect(() => {
    void refetch();
  }, []);

  async function cancelar(id: string) {
    if (!confirm("¿Cancelar esta cita? Se borra del calendario compartido con Nea.")) return;
    const res = await fetch(`/api/schedule/events/${id}`, { method: "DELETE" }).catch(
      () => null
    );
    if (!res?.ok) {
      setError("No se pudo cancelar la cita.");
      return;
    }
    void refetch();
  }

  if (notConfigured) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <CalendarClock className="h-10 w-10 text-text-3" strokeWidth={1.5} />
        <h1 className="text-lg font-semibold">Agendamiento sin configurar</h1>
        <p className="max-w-md text-sm text-text-3">
          Falta <code>GOOGLE_SERVICE_ACCOUNT_JSON</code> y{" "}
          <code>GOOGLE_CALENDAR_ID</code> en las variables de entorno — el
          mismo calendario y cuenta de servicio que ya usa Nea.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold">Agendamiento</h1>
          <p className="text-xs text-text-3">
            Mismo calendario que usa Nea para agendar por WhatsApp.
          </p>
        </div>
        <Button onClick={() => setShowNew(true)}>
          <Plus className="h-4 w-4" /> Nueva cita
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        {error && <p className="mb-4 text-sm text-danger-text">{error}</p>}

        {events === null && !error && (
          <p className="text-sm text-text-3">Cargando…</p>
        )}

        {events && events.length === 0 && (
          <p className="text-sm text-text-3">
            No hay citas en los próximos 60 días.
          </p>
        )}

        {events && events.length > 0 && (
          <div className="space-y-6">
            {groupByDay(events).map(([day, dayEvents]) => (
              <div key={day}>
                <h2 className="mb-2 text-sm font-semibold capitalize">
                  {DAY_LABEL(new Date(day))}
                </h2>
                <div className="space-y-2">
                  {dayEvents.map((ev) => (
                    <div
                      key={ev.id}
                      className="flex items-start justify-between gap-3 rounded-md border bg-card px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          {TIME_LABEL(new Date(ev.start))} –{" "}
                          {TIME_LABEL(new Date(ev.end))} · {ev.title}
                        </p>
                        {ev.description && (
                          <p className="mt-0.5 text-xs text-text-3">
                            {ev.description}
                          </p>
                        )}
                        <Badge
                          className="mt-1.5"
                          variant={ev.createdByNea ? "default" : "secondary"}
                        >
                          {ev.createdByNea ? "Agendada por Nea" : "Agendada manual"}
                        </Badge>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label="Reagendar cita"
                          onClick={() => setRescheduling(ev)}
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label="Cancelar cita"
                          onClick={() => void cancelar(ev.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showNew && (
        <NewAppointmentDialog
          onClose={() => setShowNew(false)}
          onCreated={() => {
            setShowNew(false);
            void refetch();
          }}
        />
      )}

      {rescheduling && (
        <RescheduleDialog
          event={rescheduling}
          onClose={() => setRescheduling(null)}
          onRescheduled={() => {
            setRescheduling(null);
            void refetch();
          }}
        />
      )}
    </div>
  );
}
