/** Helpers de fechas para las vistas de Semana y Mes del Agendamiento. */

/** Lunes de la semana que contiene `date` (semana laboral, no domingo-inicio). */
export function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=domingo … 6=sábado
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

/** Cuadrícula del mes completa en semanas (lunes-domingo), incluyendo días
 * del mes anterior/siguiente para rellenar la primera y última semana. */
export function monthGridStart(date: Date): Date {
  return startOfWeek(startOfMonth(date));
}

export function monthGridEnd(date: Date): Date {
  const lastDay = endOfMonth(date);
  const weekStart = startOfWeek(lastDay);
  return addDays(weekStart, 6);
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

const WEEKDAY_SHORT = new Intl.DateTimeFormat("es-MX", { weekday: "short" });
const DAY_MONTH = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short" });
const MONTH_YEAR = new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric" });
const TIME_SHORT = new Intl.DateTimeFormat("es-MX", { hour: "numeric", minute: "2-digit" });

export function weekdayShort(date: Date): string {
  const s = WEEKDAY_SHORT.format(date);
  return s.charAt(0).toUpperCase() + s.slice(1).replace(".", "");
}

export function dayMonthLabel(date: Date): string {
  return DAY_MONTH.format(date);
}

export function monthYearLabel(date: Date): string {
  const s = MONTH_YEAR.format(date);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function timeLabel(date: Date): string {
  return TIME_SHORT.format(date);
}

/** Rango [lunes, lunes+7 días) de la semana visible, para pedir eventos al API. */
export function weekRange(anchor: Date): { from: Date; to: Date } {
  const from = startOfWeek(anchor);
  return { from, to: addDays(from, 7) };
}

/** Rango de la cuadrícula del mes visible (incluye relleno de semanas vecinas). */
export function monthRange(anchor: Date): { from: Date; to: Date } {
  return { from: monthGridStart(anchor), to: addDays(monthGridEnd(anchor), 1) };
}
