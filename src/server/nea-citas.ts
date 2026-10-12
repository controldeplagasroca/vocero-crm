import { getEnv } from "@/lib/env";

/** Cita por aprobar que Nea guarda (agenda con aprobación del técnico). */
export type CitaPendiente = {
  id: number;
  tipo: "nueva" | "reagendo";
  estado: "pendiente" | "esperando_cliente";
  conversationId: string;
  plaga: string;
  fecha: string;
  inicio: string;
  direccion: string;
  nota: string | null;
  creada: string;
};

export type AccionCita = "aprobar" | "rechazar" | "proponer";

export type ResultadoCita = {
  ok: boolean;
  mensaje?: string;
  estado?: string | null;
  /** Texto de confirmación que escribe Nea, para enviarlo como mensaje de la persona. */
  textoCliente?: string | null;
};

export class NeaError extends Error {
  constructor(
    readonly status: number,
    readonly codigo: string,
    message: string
  ) {
    super(message);
  }
}

export function isNeaConfigured(): boolean {
  const env = getEnv();
  return Boolean(env.NEA_BASE_URL && env.NEA_API_SECRET);
}

async function neaFetch(path: string, init?: RequestInit): Promise<Response> {
  const env = getEnv();
  if (!env.NEA_BASE_URL || !env.NEA_API_SECRET) {
    throw new NeaError(503, "not_configured", "Nea no está conectada (NEA_BASE_URL / NEA_API_SECRET)");
  }
  try {
    return await fetch(`${env.NEA_BASE_URL.replace(/\/$/, "")}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        "x-vocero-secret": env.NEA_API_SECRET,
        ...init?.headers,
      },
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
  } catch {
    throw new NeaError(502, "nea_unreachable", "No se pudo hablar con Nea");
  }
}

export async function listarCitasPendientes(conversationId?: string): Promise<CitaPendiente[]> {
  const qs = conversationId ? `?conversationId=${encodeURIComponent(conversationId)}` : "";
  const res = await neaFetch(`/vocero/citas-pendientes${qs}`);
  if (!res.ok) throw new NeaError(res.status === 401 ? 502 : res.status, "nea_error", "Nea no pudo listar las citas");
  const data = (await res.json()) as { citas: CitaPendiente[] };
  return data.citas;
}

export async function resolverCita(
  id: number,
  accion: AccionCita,
  opts: { texto?: string; devolverTexto?: boolean } = {}
): Promise<ResultadoCita> {
  const res = await neaFetch(`/vocero/citas/${id}/resolver`, {
    method: "POST",
    body: JSON.stringify({ accion, texto: opts.texto, devolverTexto: opts.devolverTexto }),
  });
  const data = (await res.json().catch(() => ({}))) as ResultadoCita & { error?: string };
  if (res.status === 409) {
    throw new NeaError(409, "ya_resuelta", "Otra persona ya resolvió esta cita");
  }
  if (!res.ok) throw new NeaError(res.status === 401 ? 502 : res.status, "nea_error", data.error ?? "Nea no pudo resolver la cita");
  return data;
}
