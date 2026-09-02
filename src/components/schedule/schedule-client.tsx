"use client";

import { useEffect, useState } from "react";
import { CalendarClock, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NewAppointmentDialog } from "@/components/schedule/new-appointment-dialog";
import { RescheduleDialog } from "@/components/schedule/reschedule-dialog";
import { EventDetailDialog, type EventDto } from "@/components/schedule/event-detail-dialog";
import { WeekView } from "@/components/schedule/week-view";
import { MonthView } from "@/components/schedule/month-view";
import {
  addDays,
  dayMonthLabel,
  monthYearLabel,
  weekRange,
  monthRange,
  startOfWeek,
} from "@/lib/calendar-utils";
import { cn } from "@/lib/utils";

type ViewMode = "week" | "month";

export function ScheduleClient() {
  const [view, setView] = useState<ViewMode>("week");
  const [anchor, setAnchor] = useState(() => new Date());
  const [events, setEvents] = useState<EventDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [rescheduling, setRescheduling] = useState<EventDto | null>(null);
  const [viewing, setViewing] = useState<EventDto | null>(null);

  async function refetch() {
    setError(null);
    const { from, to } = view === "week" ? weekRange(anchor) : monthRange(anchor);
    const params = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
    const res = await fetch(`/api/schedule/events?${params}`).catch(() => null);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, anchor]);

  async function cancelar(id: string) {
    if (!confirm("¿Cancelar esta cita? Se borra del calendario compartido con Nea.")) return;
    const res = await fetch(`/api/schedule/events/${id}`, { method: "DELETE" }).catch(
      () => null
    );
    if (!res?.ok) {
      setError("No se pudo cancelar la cita.");
      return;
    }
    setViewing(null);
    void refetch();
  }

  function moveAnchor(dir: 1 | -1) {
    setAnchor((prev) => (view === "week" ? addDays(prev, dir * 7) : addMonths(prev, dir)));
  }

  function addMonths(d: Date, n: number): Date {
    return new Date(d.getFullYear(), d.getMonth() + n, 1);
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

  const rangeLabel =
    view === "week"
      ? `${dayMonthLabel(startOfWeek(anchor))} – ${dayMonthLabel(addDays(startOfWeek(anchor), 6))}`
      : monthYearLabel(anchor);

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-6 py-4">
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

      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-6 py-2.5">
        <div className="flex items-center gap-1">
          <div className="flex rounded-md border p-0.5">
            {(["week", "month"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                  view === v ? "bg-brand text-brand-fg" : "text-text-3 hover:text-foreground"
                )}
              >
                {v === "week" ? "Semana" : "Mes"}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" aria-label="Anterior" onClick={() => moveAnchor(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[9rem] text-center text-sm font-medium capitalize">
            {rangeLabel}
          </span>
          <Button variant="ghost" size="icon" aria-label="Siguiente" onClick={() => moveAnchor(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setAnchor(new Date())}>
            Hoy
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1">
        {error && <p className="p-4 text-sm text-danger-text">{error}</p>}

        {events === null && !error && <p className="p-4 text-sm text-text-3">Cargando…</p>}

        {events && events.length === 0 && (
          <p className="p-4 text-sm text-text-3">
            No hay citas en este {view === "week" ? "semana" : "mes"}.
          </p>
        )}

        {events && events.length > 0 && view === "week" && (
          <WeekView
            weekStart={startOfWeek(anchor)}
            events={events}
            onSelectEvent={setViewing}
          />
        )}

        {events && events.length > 0 && view === "month" && (
          <MonthView
            monthAnchor={anchor}
            events={events}
            onSelectEvent={setViewing}
            onSelectDay={(day) => {
              setView("week");
              setAnchor(day);
            }}
          />
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

      {viewing && (
        <EventDetailDialog
          event={viewing}
          onClose={() => setViewing(null)}
          onReschedule={() => {
            setRescheduling(viewing);
            setViewing(null);
          }}
          onCancel={() => void cancelar(viewing.id)}
          onAssigned={(updated) => {
            setViewing(updated);
            setEvents((prev) => prev?.map((e) => (e.id === updated.id ? updated : e)) ?? prev);
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
