import type { FichaDto } from "@/lib/types";
import { DIRECCION_FICHA_KEY } from "@/lib/ficha";

/** Datos con los que se abre el diálogo de nueva cita cuando se agenda desde
 * una conversación de la Bandeja: el cliente, su dirección y la plaga ya
 * vienen llenos y solo falta fecha y hora. */
export type AppointmentPrefill = {
  title?: string;
  notes?: string;
  address?: string;
  durationMin?: number;
  contact?: { id: string; name: string; phone: string | null };
};

/** Minutos de visita por plaga: los mismos que usa Nea para bloquear el calendario. */
export function duracionPorPlaga(plaga: string): number {
  const p = plaga.toLowerCase();
  if (/chinche|alacr|ara[ñn]a/.test(p)) return 150;
  if (/hormiga|roedor|rata|rat[oó]n/.test(p)) return 120;
  if (/pulga/.test(p)) return 100;
  if (/cucaracha/.test(p)) return 90;
  return 60;
}

function texto(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/** Lo que la conversación ya aportó (la ficha que llena Nea) para precargar la cita. */
export function prefillDesdeFicha(
  contact: { id: string; name: string; phone: string | null },
  ficha: FichaDto
): AppointmentPrefill {
  const plaga = texto(ficha.plaga);
  const direccion = texto(ficha[DIRECCION_FICHA_KEY]) || texto(ficha.geo);
  const lineas = [
    contact.phone ? `Teléfono: +${contact.phone}` : "",
    plaga && `Plaga: ${plaga}`,
    texto(ficha.cotizacion) && `Cotización: ${texto(ficha.cotizacion)}`,
    texto(ficha.notas),
  ].filter(Boolean);
  return {
    title: `Fumigación${plaga ? ` — ${plaga}` : ""} — ${contact.name}`,
    address: direccion,
    notes: lineas.join("\n"),
    durationMin: duracionPorPlaga(plaga),
    contact,
  };
}
