"use client";

import { useTechnicians } from "@/components/schedule/technician-picker";
import type { EventDto } from "@/components/schedule/event-detail-dialog";
import { addDays, isSameDay, isToday, timeLabel, weekdayShort } from "@/lib/calendar-utils";
import { cn } from "@/lib/utils";

const START_HOUR = 7;
const END_HOUR = 21;
const HOUR_PX = 56;

function minutesFromGridStart(d: Date): number {
  return (d.getHours() - START_HOUR) * 60 + d.getMinutes();
}

/** Vista semanal: cuadrícula de horas × 7 días, cada cita como bloque
 * posicionado por su horario real — para ver de un vistazo qué tan llena
 * está la semana, no solo una lista de renglones. */
export function WeekView({
  weekStart,
  events,
  onSelectEvent,
}: {
  weekStart: Date;
  events: EventDto[];
  onSelectEvent: (event: EventDto) => void;
}) {
  const { technicians } = useTechnicians();
  const namesById = new Map(technicians.map((t) => [t.id, t.name]));
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);
  const gridHeight = hours.length * HOUR_PX;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="grid grid-cols-[56px_repeat(7,1fr)] border-b">
        <div />
        {days.map((d) => (
          <div
            key={d.toISOString()}
            className={cn(
              "border-l px-2 py-2 text-center text-xs",
              isToday(d) && "bg-brand-soft"
            )}
          >
            <p className="font-semibold text-text-2">{weekdayShort(d)}</p>
            <p className={cn("text-text-3", isToday(d) && "font-semibold text-brand-text")}>
              {d.getDate()}
            </p>
          </div>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="grid grid-cols-[56px_repeat(7,1fr)]" style={{ height: gridHeight }}>
          <div className="relative">
            {hours.map((h) => (
              <div
                key={h}
                className="absolute left-0 right-0 -translate-y-1/2 pr-2 text-right text-[11px] text-text-3"
                style={{ top: (h - START_HOUR) * HOUR_PX }}
              >
                {h}:00
              </div>
            ))}
          </div>

          {days.map((day) => {
            const dayEvents = events.filter((ev) => isSameDay(new Date(ev.start), day));
            return (
              <div key={day.toISOString()} className="relative border-l">
                {hours.map((h) => (
                  <div
                    key={h}
                    className="absolute left-0 right-0 border-t"
                    style={{ top: (h - START_HOUR) * HOUR_PX }}
                  />
                ))}
                {dayEvents.map((ev) => {
                  const start = new Date(ev.start);
                  const end = new Date(ev.end);
                  const top = Math.max(0, minutesFromGridStart(start));
                  const height = Math.max(
                    22,
                    minutesFromGridStart(end) - minutesFromGridStart(start)
                  );
                  const techLabel = ev.technicianIds
                    .map((id) => namesById.get(id))
                    .filter(Boolean)
                    .join(", ");
                  return (
                    <button
                      key={ev.id}
                      onClick={() => onSelectEvent(ev)}
                      className={cn(
                        "absolute left-0.5 right-0.5 overflow-hidden rounded-md border px-1.5 py-0.5 text-left text-[11px] leading-tight shadow-sm transition-opacity hover:opacity-90",
                        ev.technicianIds.length > 0
                          ? "border-transparent bg-brand text-brand-fg"
                          : "border-warning-soft bg-warning-tint text-warning-text"
                      )}
                      style={{ top: (top / 60) * HOUR_PX, height: (height / 60) * HOUR_PX }}
                    >
                      <p className="truncate font-medium">
                        {timeLabel(start)} · {ev.title}
                      </p>
                      {techLabel && <p className="truncate opacity-90">{techLabel}</p>}
                      {!techLabel && <p className="truncate opacity-90">Sin técnico</p>}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
