"use client";

import { useState } from "react";
import { CalendarClock } from "lucide-react";
import type { CitaPendiente } from "@/server/nea-citas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { resolverCitaEnNea } from "./use-citas-pendientes";

/** Panel «Citas por aprobar» de la conversación: segunda vía de confirmación,
 * junto al «sí N» por WhatsApp del dueño y el interruptor del chat. */
export function CitasPorAprobar({
  citas,
  onSendToClient,
  onChanged,
}: {
  citas: CitaPendiente[];
  /** Envía un mensaje al cliente como persona (mismo canal que el compositor). */
  onSendToClient: (text: string) => Promise<string | null>;
  onChanged: () => void;
}) {
  const [trabajando, setTrabajando] = useState<number | null>(null);
  const [proponiendo, setProponiendo] = useState<number | null>(null);
  const [texto, setTexto] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (citas.length === 0) return null;

  async function resolver(c: CitaPendiente, accion: "aprobar" | "rechazar" | "proponer") {
    setTrabajando(c.id);
    setError(null);
    // Nea devuelve el texto y lo enviamos nosotros como mensaje de la persona: así sale
    // aunque la IA esté en pausa y no se manda dos veces.
    const r = await resolverCitaEnNea(c.id, accion, {
      texto: accion === "proponer" ? texto : undefined,
      devolverTexto: true,
    });
    if (r.error) {
      setTrabajando(null);
      setError(r.error);
      onChanged();
      return;
    }
    if (r.textoCliente) {
      const err = await onSendToClient(r.textoCliente);
      if (err) setError(`La cita se resolvió, pero el mensaje al cliente no salió: ${err}`);
    }
    setTrabajando(null);
    setProponiendo(null);
    setTexto("");
    onChanged();
  }

  return (
    <section className="border-b p-4">
      <p className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-3">
        <CalendarClock className="h-3.5 w-3.5" strokeWidth={1.7} /> Citas por aprobar
      </p>
      <ul className="space-y-3">
        {citas.map((c) => (
          <li key={c.id} className="rounded-md border bg-secondary/50 p-3">
            <p className="text-[13px] font-[650]">
              #{c.id} · {c.tipo === "reagendo" ? "Cambio de cita" : c.plaga}
            </p>
            <p className="text-xs text-text-2">{c.fecha}</p>
            {c.direccion && <p className="mt-0.5 text-xs text-text-3">📍 {c.direccion}</p>}
            {c.nota && <p className="mt-0.5 text-xs text-text-3">{c.nota}</p>}
            {c.estado === "esperando_cliente" && (
              <p className="mt-1 text-[11px] text-warning-text">
                Se le propuso otra hora al cliente; espera su respuesta.
              </p>
            )}

            {proponiendo === c.id ? (
              <div className="mt-2 space-y-2">
                <Input
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  placeholder="Ej. jueves 10 am"
                  aria-label="Otro día y hora"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={!texto.trim() || trabajando === c.id}
                    onClick={() => void resolver(c, "proponer")}
                  >
                    Proponer al cliente
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setProponiendo(null)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" disabled={trabajando === c.id} onClick={() => void resolver(c, "aprobar")}>
                  {trabajando === c.id ? "Confirmando…" : "Confirmar cita"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={trabajando === c.id}
                  onClick={() => setProponiendo(c.id)}
                >
                  Otra hora
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={trabajando === c.id}
                  onClick={() => void resolver(c, "rechazar")}
                >
                  Rechazar
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </section>
  );
}
