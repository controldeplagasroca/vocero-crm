"use client";

import { useCallback, useEffect, useState } from "react";
import type { CitaPendiente } from "@/server/nea-citas";

/** Citas por aprobar de una conversación, tal como las guarda Nea. */
export function useCitasPendientes(conversationId: string, refreshKey = 0) {
  const [citas, setCitas] = useState<CitaPendiente[]>([]);
  const [conectada, setConectada] = useState(true);

  const recargar = useCallback(async () => {
    const res = await fetch(
      `/api/nea/citas?conversationId=${encodeURIComponent(conversationId)}`
    ).catch(() => null);
    if (!res?.ok) return;
    const data = (await res.json()) as { citas: CitaPendiente[]; conectada: boolean };
    setCitas(data.citas);
    setConectada(data.conectada);
  }, [conversationId]);

  useEffect(() => {
    setCitas([]);
    void recargar();
  }, [recargar, refreshKey]);

  return { citas, conectada, recargar };
}

/** Resuelve una cita en Nea. Regresa el mensaje de error, o null si salió bien. */
export async function resolverCitaEnNea(
  id: number,
  accion: "aprobar" | "rechazar" | "proponer",
  opts: { texto?: string; devolverTexto?: boolean } = {}
): Promise<{ error: string | null; textoCliente: string | null }> {
  const res = await fetch(`/api/nea/citas/${id}/resolver`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ accion, ...opts }),
  }).catch(() => null);
  if (!res) return { error: "No se pudo conectar", textoCliente: null };
  const data = (await res.json().catch(() => null)) as {
    textoCliente?: string | null;
    error?: { code?: string; message?: string };
  } | null;
  if (!res.ok) {
    const ya = data?.error?.code === "ya_resuelta";
    return {
      error: ya
        ? "Otra persona ya resolvió esta cita (WhatsApp del dueño u otro operador)."
        : (data?.error?.message ?? `Error ${res.status}`),
      textoCliente: null,
    };
  }
  return { error: null, textoCliente: data?.textoCliente ?? null };
}
