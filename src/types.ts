/**
 * Tipos del dominio. Alineados con el modelo de datos del backend.
 */

export type RepeatType = 'once' | 'daily' | 'weekly' | 'monthly';

export const REPEAT_LABELS: Record<RepeatType, string> = {
  once: 'Una vez',
  daily: 'Diario',
  weekly: 'Semanal',
  monthly: 'Mensual',
};

export type ScheduleStatus = 'scheduled' | 'sent' | 'failed' | 'disabled';

export type Schedule = {
  id: string;
  title: string;
  message: string;
  contactName: string;
  contactNumber: string; // formato: 51999999999 (sin + ni espacios)
  /** ISO 8601, ej: 2026-06-10T09:00:00.000Z */
  scheduleDate: string;
  repeatType: RepeatType;
  enabled: boolean;
  lastSentAt: string | null;
  status: ScheduleStatus;
  createdAt: string;
};

/** Payload para crear/editar (sin campos generados por el server). */
export type ScheduleInput = {
  title: string;
  message: string;
  contactName: string;
  contactNumber: string;
  scheduleDate: string;
  repeatType: RepeatType;
  enabled: boolean;
};

/** Estado de conexión de WhatsApp vía Evolution. */
export type ConnectionState = 'connecting' | 'open' | 'close' | 'unknown';

export type WhatsAppStatus = {
  instanceName: string | null;
  phone: string | null;
  state: ConnectionState;
};

/** Contacto guardado localmente como referente. */
export type Contact = {
  id: string;
  name: string;
  number: string;
};
