/**
 * Implementación mock en memoria para iterar la UI sin backend.
 * Misma forma que las respuestas reales del backend.
 */
import type {
  Schedule,
  ScheduleInput,
  WhatsAppStatus,
} from '../types';

let idCounter = 100;
function genId() {
  idCounter += 1;
  return `mock-${idCounter}`;
}

function todayAt(hour: number, minute: number): string {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

let schedules: Schedule[] = [
  {
    id: 'mock-1',
    title: 'Recordar sacar la basura',
    message: 'Hola, recuerda sacar la basura esta noche 🗑️',
    contactName: 'Hermano',
    contactNumber: '51999999991',
    scheduleDate: todayAt(9, 0),
    repeatType: 'daily',
    enabled: true,
    lastSentAt: null,
    status: 'scheduled',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'mock-2',
    title: 'Recordar medicina',
    message: 'Hola, recuerda tomar tu medicina 💊',
    contactName: 'Mamá',
    contactNumber: '51999999992',
    scheduleDate: todayAt(13, 30),
    repeatType: 'daily',
    enabled: true,
    lastSentAt: null,
    status: 'scheduled',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'mock-3',
    title: 'Reunión equipo',
    message: 'Recuerda la reunión de las 6pm.',
    contactName: 'Carlos',
    contactNumber: '51999999993',
    scheduleDate: todayAt(18, 0),
    repeatType: 'weekly',
    enabled: false,
    lastSentAt: null,
    status: 'disabled',
    createdAt: new Date().toISOString(),
  },
];

const delay = (ms = 250) => new Promise((r) => setTimeout(r, ms));

function statusFor(s: { enabled: boolean }): Schedule['status'] {
  if (!s.enabled) return 'disabled';
  return 'scheduled';
}

export async function listSchedules(): Promise<Schedule[]> {
  await delay();
  return [...schedules].sort((a, b) =>
    a.scheduleDate.localeCompare(b.scheduleDate)
  );
}

export async function createSchedule(
  input: ScheduleInput
): Promise<Schedule> {
  await delay();
  const created: Schedule = {
    id: genId(),
    ...input,
    lastSentAt: null,
    status: statusFor(input),
    createdAt: new Date().toISOString(),
  };
  schedules.push(created);
  return created;
}

export async function updateSchedule(
  id: string,
  input: Partial<ScheduleInput>
): Promise<Schedule> {
  await delay();
  const idx = schedules.findIndex((s) => s.id === id);
  if (idx === -1) throw new Error('No encontrado');
  const merged = { ...schedules[idx], ...input };
  merged.status = statusFor(merged);
  schedules[idx] = merged;
  return merged;
}

export async function deleteSchedule(id: string): Promise<void> {
  await delay();
  schedules = schedules.filter((s) => s.id !== id);
}

// --- Estado simulado de conexión + auth, para iterar sin backend ---
let mockState: WhatsAppStatus['state'] = 'close';
let mockPhone: string | null = null;
let connectedAt = 0;
// "BD" de usuarios mock: número -> password (en claro, solo para el mock).
const mockUsers = new Map<string, string>();

function norm(number: string): string {
  const d = number.replace(/[^\d]/g, '');
  return d.length === 9 ? `51${d}` : d;
}

export async function authConnect(number: string) {
  await delay(500);
  mockPhone = norm(number);
  mockState = 'connecting';
  connectedAt = Date.now();
  return { pairingCode: 'ABCD-1234', state: 'connecting' as const };
}

export async function authCancel(_number: string) {
  await delay(200);
  // Simula que se canceló: la instancia temporal "se borra".
  mockState = 'close';
  connectedAt = 0;
  return { ok: true };
}

export async function authState(number: string) {
  await delay();
  // ~4s después de connect, simula que quedó vinculado.
  if (mockState === 'connecting' && connectedAt && Date.now() - connectedAt > 4000) {
    mockState = 'open';
  }
  return { state: mockState, registered: mockUsers.has(norm(number)) };
}

export async function authRegister(number: string, password: string) {
  await delay();
  const phone = norm(number);
  mockUsers.set(phone, password);
  mockPhone = phone;
  mockState = 'open';
  return { token: `mock-token-${phone}`, phone };
}

export async function authLogin(number: string, password: string) {
  await delay();
  const phone = norm(number);
  if (mockUsers.get(phone) !== password) {
    const { ApiError } = await import('./client');
    throw new ApiError(401, 'Contraseña incorrecta');
  }
  mockPhone = phone;
  mockState = 'open';
  return { token: `mock-token-${phone}`, phone };
}

export async function getWhatsAppStatus(): Promise<WhatsAppStatus> {
  await delay();
  return {
    instanceName: mockPhone ? `whatsapp-scheduler-${mockPhone}` : null,
    phone: mockState === 'open' ? mockPhone : null,
    state: mockState,
  };
}

export async function reconnectWhatsApp() {
  await delay(500);
  mockState = 'connecting';
  connectedAt = Date.now();
  return { pairingCode: 'RECONN-99', state: 'connecting' as const };
}

export async function logoutWhatsApp(): Promise<void> {
  await delay();
  mockState = 'close';
}

export async function deleteAccount(): Promise<void> {
  await delay();
  schedules = [];
  if (mockPhone) mockUsers.delete(mockPhone);
  mockState = 'close';
  mockPhone = null;
  connectedAt = 0;
}
