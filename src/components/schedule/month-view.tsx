"use client";

import { useTechnicians } from "@/components/schedule/technician-picker";
import type { EventDto } from "@/components/schedule/event-detail-dialog";
import {
  addDays,
  isSameDay,
  isToday,
  monthGridStart,
  timeLabel,
  weekdayShort,
} from "@/lib/calendar-utils";
import { cn } from "@/lib/utils";

const MAX_VISIBLE_PER_DAY = 3;

/**
 * Vista mensual: una cuadrícula de días con la carga de citas de cada uno —
 * la pregunta "¿qué tan llena está la agenda?" se contesta viendo qué días
 * están cargados de un vistazo, sin abrir cada uno.
 */
export function MonthView({
  monthAnchor,
  events,
  onSelectEvent,
  onSelectDay,
}: {
  monthAnchor: Date;
  events: EventDto[];
  onSelectEvent: (event: EventDto) => void;
  onSelectDay: (day: Date) => void;
}) {
  const { technicians } = useTechnicians();
  const namesById = new Map(technicians.map((t) => [t.id, t.name]));
  const gridStart = monthGridStart(monthAnchor);
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const weekdayHeader = Array.from({ length: 7 }, (_, i) => addDays(gridStart, i));
  const currentMonth = monthAnchor.getMonth();

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="grid grid-cols-7 border-b">
        {weekdayHeader.map((d) => (
          <div key={d.toISOString()} className="border-l px-2 py-1.5 text-center text-xs font-semibold text-text-3 first:border-l-0">
            {weekdayShort(d)}
          </div>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-7 grid-rows-6 overflow-y-auto">
        {days.map((day) => {
          const dayEvents = events
            .filter((ev) => isSameDay(new Date(ev.start), day))
            .sort((a, b) => a.start.localeCompare(b.start));
          const outOfMonth = day.getMonth() !== currentMonth;
          const overflow = dayEvents.length - MAX_VISIBLE_PER_DAY;

          return (
            <button
              key={day.toISOString()}
              onClick={() => onSelectDay(day)}
              className={cn(
                "flex min-h-[92px] flex-col gap-0.5 border-b border-l p-1 text-left first-of-type:border-l-0",
                outOfMonth && "bg-secondary/30",
                isToday(day) && "bg-brand-soft"
              )}
            >
              <span
                className={cn(
                  "text-xs",
                  outOfMonth ? "text-text-4" : "text-text-2",
                  isToday(day) && "font-semibold text-brand-text"
                )}
              >
                {day.getDate()}
              </span>
              <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
                {dayEvents.slice(0, MAX_VISIBLE_PER_DAY).map((ev) => {
                  const hasTechnician = ev.technicianIds.length > 0;
                  const techLabel = ev.technicianIds.map((id) => namesById.get(id) ?? "").filter(Boolean)[0];
                  return (
                    <span
                      key={ev.id}
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectEvent(ev);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.stopPropagation();
                          onSelectEvent(ev);
                        }
                      }}
                      className={cn(
                        "truncate rounded px-1 py-0.5 text-[10px] leading-tight",
                        hasTechnician
                          ? "bg-brand text-brand-fg"
                          : "bg-warning-tint text-warning-text"
                      )}
                      title={ev.title}
                    >
                      {timeLabel(new Date(ev.start))} {ev.title}
                      {techLabel ? ` · ${techLabel}` : ""}
                    </span>
                  );
                })}
                {overflow > 0 && (
                  <span className="px-1 text-[10px] text-text-3">+{overflow} más</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
