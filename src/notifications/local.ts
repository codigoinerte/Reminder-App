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

/**
 * Construye el trigger según la repetición. Para 'once' usamos la fecha exacta.
 * Para repeticiones, expo dispara a la próxima ocurrencia de esa hora (no
 * admite fecha de inicio en triggers nativos), así que tomamos hora/día de la
 * fecha elegida.
 */
function triggerFor(
  repeatType: RepeatType,
  date: Date
): Notifications.NotificationTriggerInput {
  const hour = date.getHours();
  const minute = date.getMinutes();
  switch (repeatType) {
    case 'daily':
      return {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      };
    case 'weekly':
      return {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        // expo usa 1-7 con domingo=1; getDay() da 0-6 con domingo=0.
        weekday: date.getDay() + 1,
        hour,
        minute,
      };
    case 'monthly':
      return {
        type: Notifications.SchedulableTriggerInputTypes.MONTHLY,
        day: date.getDate(),
        hour,
        minute,
      };
    case 'once':
    default:
      return {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date,
      };
  }
}

/**
 * Programa (o reprograma) la notificación local de un recordatorio. Primero
 * cancela cualquier notificación previa de ese mismo recordatorio para no
 * duplicar. Guarda el id resultante en AsyncStorage. Si no hay permiso, no
 * programa y devuelve false.
 *
 * El `data.scheduleId` permite que el tap abra el detalle del recordatorio.
 */
export async function scheduleReminderNotification(params: {
  scheduleId: string;
  title: string;
  message: string;
  date: Date;
  repeatType: RepeatType;
}): Promise<boolean> {
  await cancelReminderNotification(params.scheduleId);

  const granted = await ensureNotificationPermission();
  if (!granted) return false;

  const notifId = await Notifications.scheduleNotificationAsync({
    content: {
      title: params.title || 'Recordatorio',
      body: params.message,
      data: { scheduleId: params.scheduleId },
    },
    trigger: triggerFor(params.repeatType, params.date),
  });

  await AsyncStorage.setItem(idKey(params.scheduleId), notifId);
  return true;
}

/** Cancela la notificación local de un recordatorio (si existía). */
export async function cancelReminderNotification(
  scheduleId: string
): Promise<void> {
  const key = idKey(scheduleId);
  const existing = await AsyncStorage.getItem(key);
  if (existing) {
    await Notifications.cancelScheduledNotificationAsync(existing).catch(
      () => {}
    );
    await AsyncStorage.removeItem(key);
  }
}

/** ¿Este recordatorio tiene una notificación local programada en este teléfono? */
export async function hasReminderNotification(
  scheduleId: string
): Promise<boolean> {
  return (await AsyncStorage.getItem(idKey(scheduleId))) != null;
}
