"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type EventDto = {
  id: string;
  title: string;
  start: string;
  end: string;
};

function toLocalDateInput(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function toLocalTimeInput(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Reagendar una cita existente a un nuevo horario — mueve el mismo evento
 * (`events.patch`) en vez de cancelarlo y crear uno nuevo. */
export function RescheduleDialog({
  event,
  onClose,
  onRescheduled,
}: {
  event: EventDto;
  onClose: () => void;
  onRescheduled: () => void;
}) {
  const originalDurationMs = new Date(event.end).getTime() - new Date(event.start).getTime();
  const [date, setDate] = useState(toLocalDateInput(event.start));
  const [time, setTime] = useState(toLocalTimeInput(event.start));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    setSaving(true);
    setError(null);
    const start = new Date(`${date}T${time}:00`);
    const end = new Date(start.getTime() + originalDurationMs);
    const res = await fetch(`/api/schedule/events/${event.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ start: start.toISOString(), end: end.toISOString() }),
    }).catch(() => null);
    setSaving(false);
    if (!res?.ok) {
      const data = (await res?.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      setError(data?.error?.message ?? "No se pudo reagendar la cita");
      return;
    }
    onRescheduled();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="Reagendar cita"
        className="w-full max-w-md rounded-lg border bg-card p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-1 font-semibold">Reagendar cita</h3>
        <p className="mb-4 text-xs text-text-3">
          {event.title} — se mueve al nuevo horario conservando la misma duración.
        </p>

        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="rs-date">Nueva fecha</Label>
            <Input id="rs-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rs-time">Nueva hora</Label>
            <Input id="rs-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
        </div>

        {error && <p className="mt-3 text-xs text-danger-text">{error}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={saving} onClick={() => void guardar()}>
            {saving ? "Reagendando…" : "Reagendar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
