/**
 * Utilidades de formato de fecha/hora y números de teléfono.
 */

export function formatTime(iso: string): string {
  const d = new Date(iso);
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  const mm = m.toString().padStart(2, '0');
  return `${h.toString().padStart(2, '0')}:${mm} ${ampm}`;
}

/**
 * Formatea una hora guardada en UTC (hour/minute) como hora LOCAL legible.
 * Construye un instante de hoy a esa hora UTC y lo pasa por formatTime (que
 * usa la zona local del dispositivo).
 */
export function formatHourMinuteUTC(hour: number, minute: number): string {
  const d = new Date();
  d.setUTCHours(hour, minute, 0, 0);
  return formatTime(d.toISOString());
}

/** Etiquetas cortas de los días de semana (0=domingo..6=sábado). */
export const WEEKDAY_LABELS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
/** Etiquetas cortas de 3 letras (para tarjetas). */
export const WEEKDAY_LABELS_3 = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('es-PE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

/** Etiqueta de día para agrupar el timeline: "Hoy", "Mañana" o la fecha. */
export function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (sameDay(d, today)) return 'Hoy';
  if (sameDay(d, tomorrow)) return 'Mañana';
  return formatDate(iso);
}

/** Clave de agrupamiento estable por día (YYYY-MM-DD). */
export function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${(d.getMonth() + 1)
    .toString()
    .padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
}

/**
 * Normaliza un número a formato Evolution: solo dígitos, sin + ni espacios.
 * Ej: "+51 999 999 999" -> "51999999999"
 */
export function normalizeNumber(raw: string): string {
  return raw.replace(/[^\d]/g, '');
}

export function getDeviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}
