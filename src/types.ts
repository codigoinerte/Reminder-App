/**
 * Tipos del dominio. Alineados con el modelo de datos del backend.
 */

export type RepeatType = 'once' | 'daily' | 'weekly' | 'monthly' | 'custom';

export const REPEAT_LABELS: Record<RepeatType, string> = {
  once: 'Una vez',
  daily: 'Diario',
  weekly: 'Semanal',
  monthly: 'Mensual',
  custom: 'Personalizado',
};

export type ScheduleStatus = 'scheduled' | 'sent' | 'failed' | 'disabled';

/**
 * Una hora programada dentro de un recordatorio.
 * OJO — zona horaria: hour/minute están en UTC (la app convierte la hora local
 * elegida a UTC al guardar, igual que el modelo anterior con toISOString()).
 */
export type ScheduleTime = {
  id: string;
  sortOrder: number;
  hour: number; // 0–23 (UTC)
  minute: number; // 0–59 (UTC)
  /** Texto propio de esta hora. null => usa el mensaje base del recordatorio. */
  message: string | null;
};

export type Schedule = {
  id: string;
  title: string;
  message: string;
  contactName: string;
  contactNumber: string; // formato: 51999999999 (sin + ni espacios)
  /** ISO 8601. Fecha ancla / de inicio (y hora exacta en el caso 'once'). */
  scheduleDate: string;
  repeatType: RepeatType;
  /** Días de semana (0=domingo..6=sábado). Solo aplica a repeatType 'custom'. */
  weekDays: number[];
  /** Si true, todas las horas usan `message`; si false, cada hora su propio texto. */
  sameMessage: boolean;
  /** Horas programadas (≥1). */
  times: ScheduleTime[];
  enabled: boolean;
  /** Textos alternativos (solo repetitivos). El server rota entre estos y `message`. */
  messageVariants: string[];
  lastSentAt: string | null;
  status: ScheduleStatus;
  createdAt: string;
};

/** Una hora en el payload de creación/edición. */
export type ScheduleTimeInput = {
  hour: number;
  minute: number;
  /** Override opcional; solo se usa si sameMessage === false. */
  message?: string | null;
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
  /** Días de semana (0–6); obligatorio y no vacío si repeatType === 'custom'. */
  weekDays?: number[];
  /** Toggle "mismo mensaje en todas las horas" (default true). */
  sameMessage?: boolean;
  /** Horas del recordatorio (≥1 obligatorio). */
  times: ScheduleTimeInput[];
  /** Variantes opcionales; el server las ignora si repeatType === 'once'. */
  messageVariants?: string[];
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
