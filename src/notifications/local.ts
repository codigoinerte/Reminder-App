/**
 * Notificaciones LOCALES en este teléfono (independientes del envío por
 * WhatsApp que hace el backend). Cuando el usuario activa "Notificarme en este
 * teléfono" al crear un recordatorio, programamos una notificación local con
 * expo-notifications para que el sistema operativo la dispare a la hora elegida
 * con el contenido del mensaje.
 *
 * IMPORTANTE: esto vive SOLO en el dispositivo que creó el recordatorio. No se
 * sincroniza ni lo dispara el servidor. Si se reinstala la app o se cambia de
 * teléfono, las notificaciones locales no reaparecen.
 *
 * Para poder cancelar/reprogramar la notificación de un recordatorio guardamos
 * la relación scheduleId -> notificationId en AsyncStorage.
 */
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import type { RepeatType } from '../types';

/** Clave de la notificación local asociada a un recordatorio. */
const idKey = (scheduleId: string) => `notif:${scheduleId}`;

/**
 * Presentación en primer plano: mostrar banner y en la lista. Se registra una
 * vez al arrancar la app (App.tsx). Los campos shouldShowBanner/shouldShowList
 * son obligatorios en las versiones recientes de expo-notifications.
 */
export function configureNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/**
 * Pide permiso de notificaciones (idempotente). En Android crea además el canal
 * por defecto para que las notificaciones se muestren con sonido. Devuelve true
 * si quedó concedido.
 */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Recordatorios',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const req = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: true, allowSound: true },
  });
  return req.granted;
}

/** Una hora del recordatorio (hour/minute en UTC, como las guarda el backend). */
export type NotifTime = {
  hour: number;
  minute: number;
  message: string | null;
};

/** Convierte una hora UTC (hour/minute) a la hora LOCAL del dispositivo. */
function utcToLocalHM(hour: number, minute: number): { hour: number; minute: number } {
  const d = new Date();
  d.setUTCHours(hour, minute, 0, 0);
  return { hour: d.getHours(), minute: d.getMinutes() };
}

/**
 * Construye los triggers de UNA hora según la repetición. Devuelve un array
 * porque 'custom' genera un trigger semanal por cada día seleccionado.
 * hour/minute entran en UTC y se convierten a local (expo usa hora local).
 */
function triggersFor(
  repeatType: RepeatType,
  timeUtc: { hour: number; minute: number },
  anchor: Date,
  weekDays: number[]
): Notifications.NotificationTriggerInput[] {
  const { hour, minute } = utcToLocalHM(timeUtc.hour, timeUtc.minute);
  switch (repeatType) {
    case 'daily':
      return [{ type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute }];
    case 'weekly':
      return [
        {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          // expo usa 1-7 con domingo=1; getDay() da 0-6 con domingo=0.
          weekday: anchor.getDay() + 1,
          hour,
          minute,
        },
      ];
    case 'monthly':
      return [
        {
          type: Notifications.SchedulableTriggerInputTypes.MONTHLY,
          day: anchor.getDate(),
          hour,
          minute,
        },
      ];
    case 'custom':
      // Un trigger semanal por cada día marcado (0=domingo..6=sábado → 1-7).
      return weekDays.map((wd) => ({
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: wd + 1,
        hour,
        minute,
      }));
    case 'once':
    default: {
      // Fecha ancla a la hora local de esta franja.
      const date = new Date(anchor);
      date.setHours(hour, minute, 0, 0);
      return [{ type: Notifications.SchedulableTriggerInputTypes.DATE, date }];
    }
  }
}

/**
 * Programa (o reprograma) las notificaciones locales de un recordatorio: UNA
 * por cada hora (y por cada día en 'custom'). Cancela primero las previas para
 * no duplicar. Guarda TODOS los ids resultantes (array JSON) en AsyncStorage.
 * Si no hay permiso, no programa y devuelve false.
 */
export async function scheduleReminderNotification(params: {
  scheduleId: string;
  title: string;
  baseMessage: string;
  sameMessage: boolean;
  times: NotifTime[];
  weekDays: number[];
  anchor: Date;
  repeatType: RepeatType;
}): Promise<boolean> {
  await cancelReminderNotification(params.scheduleId);

  const granted = await ensureNotificationPermission();
  if (!granted) return false;

  const ids: string[] = [];
  for (const t of params.times) {
    const body =
      params.sameMessage || !t.message ? params.baseMessage : t.message;
    const triggers = triggersFor(
      params.repeatType,
      { hour: t.hour, minute: t.minute },
      params.anchor,
      params.weekDays
    );
    for (const trigger of triggers) {
      const notifId = await Notifications.scheduleNotificationAsync({
        content: {
          title: params.title || 'Recordatorio',
          body,
          data: { scheduleId: params.scheduleId },
        },
        trigger,
      }).catch(() => null);
      if (notifId) ids.push(notifId);
    }
  }

  await AsyncStorage.setItem(idKey(params.scheduleId), JSON.stringify(ids));
  return true;
}

/** Cancela TODAS las notificaciones locales de un recordatorio (si existían). */
export async function cancelReminderNotification(
  scheduleId: string
): Promise<void> {
  const key = idKey(scheduleId);
  const existing = await AsyncStorage.getItem(key);
  if (!existing) return;
  // Compat: antes se guardaba un solo id (string plano); ahora un array JSON.
  let ids: string[];
  try {
    const parsed = JSON.parse(existing);
    ids = Array.isArray(parsed) ? parsed : [existing];
  } catch {
    ids = [existing];
  }
  for (const id of ids) {
    await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
  }
  await AsyncStorage.removeItem(key);
}

/** ¿Este recordatorio tiene una notificación local programada en este teléfono? */
export async function hasReminderNotification(
  scheduleId: string
): Promise<boolean> {
  return (await AsyncStorage.getItem(idKey(scheduleId))) != null;
}
