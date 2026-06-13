/**
 * Cliente HTTP hacia nuestro backend.
 *
 * La app NO habla directamente con Evolution API: todo pasa por el backend
 * (fuente de verdad + scheduler). Las rutas protegidas requieren un JWT que se
 * obtiene al registrarse/iniciar sesión; el AuthContext lo inyecta aquí.
 */
import { API_BASE_URL } from '../config';
import type { ConnectionState, Schedule, ScheduleInput, WhatsAppStatus } from '../types';

// Token de sesión actual. El AuthContext lo setea tras login/registro.
let authToken: string | null = null;
export function setAuthToken(token: string | null) {
  authToken = token;
}

// Callback que se dispara cuando una petición AUTENTICADA recibe 401 (token
// expirado/inválido). El AuthContext lo registra con signOut para sacar al
// usuario al login de forma limpia. No se dispara en el 401 de login (ahí
// todavía no hay token).
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}

/** Error con el status HTTP para que la UI distinga 401/404/etc. */
export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Timeout por defecto para no dejar peticiones colgadas (Splash infinito). */
const REQUEST_TIMEOUT_MS = 12000;

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    ...((options.headers as Record<string, string>) ?? {}),
  };
  // Solo declaramos JSON cuando realmente enviamos un body; si no, un body
  // vacío con Content-Type: application/json hace que el backend falle al
  // parsear (entity.parse.failed → 400).
  if (options.body != null) headers['Content-Type'] = 'application/json';
  const wasAuthenticated = !!authToken;
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  // AbortController para que ningún fetch cuelgue indefinidamente: si el
  // backend no responde, rechazamos y la UI sale del estado de carga.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    });
  } catch (e: any) {
    if (e?.name === 'AbortError') {
      throw new ApiError(0, 'Tiempo de espera agotado. Revisa tu conexión.');
    }
    throw new ApiError(0, e?.message ?? 'No se pudo conectar.');
  } finally {
    clearTimeout(timeout);
  }
  const text = await res.text();
  const body = text ? safeJson(text) : undefined;
  if (!res.ok) {
    // 401 en una petición que SÍ llevaba token = sesión expirada/inválida.
    // Avisamos al AuthContext para que cierre sesión y caiga al login limpio.
    if (res.status === 401 && wasAuthenticated) {
      onUnauthorized?.();
    }
    const msg =
      (body && typeof body === 'object' && 'error' in body
        ? (body as any).error
        : null) ?? `HTTP ${res.status}`;
    throw new ApiError(res.status, msg);
  }
  return body as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// ---- Auth ----

export async function authConnect(number: string): Promise<{
  pairingCode: string | null;
  state: ConnectionState;
}> {
  return request('/auth/connect', {
    method: 'POST',
    body: JSON.stringify({ number }),
  });
}

/** Cancela una vinculación en curso: borra la instancia temporal en Evolution. */
export async function authCancel(number: string): Promise<{ ok: boolean }> {
  return request('/auth/cancel', {
    method: 'POST',
    body: JSON.stringify({ number }),
  });
}

export async function authState(number: string): Promise<{
  state: ConnectionState;
  registered: boolean;
}> {
  return request(`/auth/state?number=${encodeURIComponent(number)}`);
}

export async function authRegister(
  number: string,
  password: string
): Promise<{ token: string; phone: string }> {
  return request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ number, password }),
  });
}

export async function authLogin(
  number: string,
  password: string
): Promise<{ token: string; phone: string }> {
  return request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ number, password }),
  });
}

// ---- Schedules ----

export async function listSchedules(): Promise<Schedule[]> {
  return request<Schedule[]>('/schedules');
}

export async function createSchedule(input: ScheduleInput): Promise<Schedule> {
  return request<Schedule>('/schedules', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateSchedule(
  id: string,
  input: Partial<ScheduleInput>
): Promise<Schedule> {
  return request<Schedule>(`/schedules/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export async function deleteSchedule(id: string): Promise<void> {
  return request<void>(`/schedules/${id}`, { method: 'DELETE' });
}

export async function toggleSchedule(
  id: string,
  enabled: boolean
): Promise<Schedule> {
  return request<Schedule>(`/schedules/${id}/enabled`, {
    method: 'PATCH',
    body: JSON.stringify({ enabled }),
  });
}

// ---- WhatsApp ----

export async function getWhatsAppStatus(): Promise<WhatsAppStatus> {
  return request<WhatsAppStatus>('/whatsapp/status');
}

export type WhatsAppContact = { number: string; name: string };

/**
 * Lista los contactos de WhatsApp del usuario (de su instancia). El número ya
 * viene en formato internacional. Devuelve [] si WhatsApp no está conectado.
 */
export async function getWhatsAppContacts(): Promise<WhatsAppContact[]> {
  const res = await request<{ contacts: WhatsAppContact[] }>('/whatsapp/contacts');
  return res.contacts ?? [];
}

/** Regenera el pairing code para reconectar (requiere sesión). */
export async function reconnectWhatsApp(): Promise<{
  pairingCode: string | null;
  state: ConnectionState;
}> {
  return request('/whatsapp/reconnect', { method: 'POST' });
}

export async function logoutWhatsApp(): Promise<void> {
  return request<void>('/whatsapp/logout', { method: 'DELETE' });
}

export async function deleteAccount(): Promise<void> {
  return request<void>('/whatsapp/account', { method: 'DELETE' });
}
