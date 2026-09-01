"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/** Alta manual de una cita — para agendar por teléfono, un reagendo, o
 * cualquier caso que no pasó por la conversación de WhatsApp con Nea. */
export function NewAppointmentDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const today = new Date();
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(today.toISOString().slice(0, 10));
  const [time, setTime] = useState("10:00");
  const [durationMin, setDurationMin] = useState(60);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    setSaving(true);
    setError(null);
    const start = new Date(`${date}T${time}:00`);
    const end = new Date(start.getTime() + durationMin * 60_000);
    const res = await fetch("/api/schedule/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        description: notes.trim() || undefined,
        start: start.toISOString(),
        end: end.toISOString(),
      }),
    }).catch(() => null);
    setSaving(false);
    if (!res?.ok) {
      const data = (await res?.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      setError(data?.error?.message ?? "No se pudo agendar la cita");
      return;
    }
    onCreated();
  }

  const listo = title.trim().length > 0 && date.length > 0 && time.length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="Nueva cita"
        className="w-full max-w-md rounded-lg border bg-card p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-1 font-semibold">Nueva cita</h3>
        <p className="mb-4 text-xs text-text-3">
          Se agenda en el mismo calendario que usa Nea — el bot la va a
          respetar como cualquier otro horario ya ocupado.
        </p>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="na-title">Título</Label>
            <Input
              id="na-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Fumigación — Restaurante La Palma"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="na-date">Fecha</Label>
              <Input
                id="na-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="na-time">Hora</Label>
              <Input
                id="na-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="na-duration">Duración (minutos)</Label>
            <Input
              id="na-duration"
              type="number"
              min={15}
              step={15}
              value={durationMin}
              onChange={(e) => setDurationMin(Number(e.target.value) || 60)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="na-notes">Notas (opcional)</Label>
            <Textarea
              id="na-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Dirección, referencia del cliente, plaga a tratar…"
            />
          </div>
        </div>

        {error && <p className="mt-3 text-xs text-danger-text">{error}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={!listo || saving} onClick={() => void guardar()}>
            {saving ? "Agendando…" : "Agendar cita"}
          </Button>
        </div>
      </div>
    </div>
  );
}
