"use client";

import { useState } from "react";
import { MapPin, RotateCcw, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TechnicianPicker, useTechnicians } from "@/components/schedule/technician-picker";
import { dayMonthLabel, timeLabel } from "@/lib/calendar-utils";

export type EventDto = {
  id: string;
  title: string;
  description: string | null;
  start: string;
  end: string;
  createdByNea: boolean;
  address: string | null;
  contactId: string | null;
  technicianIds: string[];
};

/**
 * Detalle de una cita: para qué técnico se asigna y dónde es — la pregunta
 * que motivó este panel ("qué tan llena está la agenda y a quién se la doy")
 * se contesta aquí, no solo viendo el bloque en la cuadrícula.
 */
export function EventDetailDialog({
  event,
  onClose,
  onReschedule,
  onCancel,
  onAssigned,
}: {
  event: EventDto;
  onClose: () => void;
  onReschedule: () => void;
  onCancel: () => void;
  onAssigned: (event: EventDto) => void;
}) {
  const { technicians } = useTechnicians();
  const [selected, setSelected] = useState<string[]>(event.technicianIds);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  async function guardarAsignacion() {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/schedule/events/${event.id}/assign`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ technicianIds: selected }),
    }).catch(() => null);
    setSaving(false);
    if (!res?.ok) {
      setError("No se pudo guardar la asignación");
      return;
    }
    const data = (await res.json()) as { event: EventDto };
    setDirty(false);
    onAssigned(data.event);
  }

  const namesById = new Map(technicians.map((t) => [t.id, t.name]));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="Detalle de cita"
        className="w-full max-w-md rounded-lg border bg-card p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-start justify-between gap-2">
          <h3 className="font-semibold">{event.title}</h3>
          <Badge variant={event.createdByNea ? "default" : "secondary"}>
            {event.createdByNea ? "Nea" : "Manual"}
          </Badge>
        </div>
        <p className="mb-3 text-xs text-text-3">
          {dayMonthLabel(new Date(event.start))} · {timeLabel(new Date(event.start))}–
          {timeLabel(new Date(event.end))}
        </p>

        {event.address && (
          <p className="mb-3 flex items-start gap-1.5 text-xs text-text-2">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-text-3" />
            {event.address}
          </p>
        )}

        {event.description && (
          <p className="mb-3 whitespace-pre-wrap text-xs text-text-3">{event.description}</p>
        )}

        {!dirty && event.technicianIds.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {event.technicianIds.map((id) => (
              <Badge key={id} variant="outline">
                {namesById.get(id) ?? "Técnico"}
              </Badge>
            ))}
          </div>
        )}

        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-3">
            Técnico(s) asignado(s)
          </p>
          <TechnicianPicker
            selectedIds={selected}
            onChange={(ids) => {
              setSelected(ids);
              setDirty(true);
            }}
          />
          {dirty && (
            <div className="mt-2 flex gap-1.5">
              <Button size="sm" disabled={saving} onClick={() => void guardarAsignacion()}>
                {saving ? "Guardando…" : "Guardar asignación"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setSelected(event.technicianIds);
                  setDirty(false);
                }}
              >
                Deshacer
              </Button>
            </div>
          )}
        </div>

        {error && <p className="mt-3 text-xs text-danger-text">{error}</p>}

        <div className="mt-4 flex justify-between gap-2 border-t pt-3">
          <Button variant="ghost" onClick={onClose}>
            Cerrar
          </Button>
          <div className="flex gap-1.5">
            <Button variant="outline" size="sm" onClick={onReschedule}>
              <RotateCcw className="h-3.5 w-3.5" /> Reagendar
            </Button>
            <Button variant="outline" size="sm" onClick={onCancel}>
              <Trash2 className="h-3.5 w-3.5" /> Cancelar cita
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
