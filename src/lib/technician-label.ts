/**
 * Cómo se ve el técnico asignado en Google Calendar: su nombre en el título y en
 * la primera línea de la descripción, y un color propio por técnico. Todo esto
 * es TEXTO VISIBLE; los ids que usa Vocero van aparte, en una propiedad oculta
 * del evento (`technicianIds`).
 */

/** Colores de evento de Google (colorId) que se distinguen bien entre sí. Se
 * omite el 8 (grafito) porque es casi el de «sin color». */
export const PALETA_COLORES = ["9", "11", "10", "5", "3", "6", "7", "4", "2", "1"] as const;

const SUFIJO_TITULO = /\s+·\s+👷[^\n]*$/u;
const LINEA_TECNICO = /^Técnico:[^\n]*\n?/u;

/** El técnico que ocupa el lugar `orden.indexOf(id)` en la lista (por antigüedad)
 * recibe siempre el mismo color: con hasta 10 técnicos no se repite ninguno. */
export function colorParaTecnico(technicianId: string, orden: string[]): string {
  const i = Math.max(0, orden.indexOf(technicianId));
  return PALETA_COLORES[i % PALETA_COLORES.length]!;
}

/** «Fumigación — Chinches» → «Fumigación — Chinches · 👷 Juan» (sin duplicar al reasignar). */
export function tituloConTecnico(titulo: string, nombre: string | null): string {
  const limpio = titulo.replace(SUFIJO_TITULO, "");
  return nombre ? `${limpio} · 👷 ${nombre}` : limpio;
}

/** Pone «Técnico: Juan» como primera línea; el resto (incluido el bloque de datos
 * que lee ROCA OPS) queda intacto. */
export function descripcionConTecnico(descripcion: string | null, nombre: string | null): string {
  const resto = (descripcion ?? "").replace(LINEA_TECNICO, "");
  return nombre ? `Técnico: ${nombre}\n${resto}` : resto;
}

/** Los últimos 10 dígitos de un teléfono: compara «+52 1 55 1234 5678» con «5512345678». */
export function ultimos10(telefono: string | null | undefined): string {
  return (telefono ?? "").replace(/\D/g, "").slice(-10);
}
