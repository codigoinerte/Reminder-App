/**
 * Lectura de la agenda del teléfono (expo-contacts) y cruce con los contactos
 * de WhatsApp (Evolution).
 *
 * SDK 56: la API moderna de expo-contacts quitó `getContactsAsync` (lanza en
 * runtime). La lectura de la lista completa vive ahora en `expo-contacts/legacy`.
 *
 * El cruce resuelve el problema de que Evolution trae ~1000 contactos (gente de
 * grupos incluida) sin el nombre de la agenda: nos quedamos solo con los que TÚ
 * tienes agendados Y que además tienen WhatsApp, usando el nombre de tu agenda.
 */
import * as ContactsLegacy from 'expo-contacts/legacy';
import { normalizeNumber } from '../utils/format';
import { DEFAULT_COUNTRY } from './countries';
import type { WhatsAppContact } from '../api/client';

export type MatchedContact = {
  /** Nombre tal como está en la agenda del teléfono. */
  name: string;
  /** Número en formato internacional (con código de país), listo para enviar. */
  number: string;
};

/**
 * Genera variantes normalizadas de un número para comparar de forma robusta.
 * Cubre el caso de que la agenda tenga "999888777" (local) mientras WhatsApp lo
 * tiene como "51999888777" (internacional): comparamos por el SUFIJO de dígitos.
 */
function numberKeys(raw: string): string[] {
  const digits = normalizeNumber(raw);
  if (!digits) return [];
  const keys = new Set<string>([digits]);
  // Sufijos largos: los últimos 8 y 9 dígitos (núcleo del número sin prefijos).
  if (digits.length >= 9) keys.add(digits.slice(-9));
  if (digits.length >= 8) keys.add(digits.slice(-8));
  return [...keys];
}

/**
 * Lee la agenda del teléfono y la cruza con los contactos de WhatsApp.
 * Devuelve SOLO los contactos agendados que tienen WhatsApp, con el nombre de
 * la agenda y el número en formato internacional (el de Evolution, que ya trae
 * código de país).
 *
 * Lanza si el permiso de contactos es denegado (la UI lo maneja).
 */
export async function matchAgendaWithWhatsApp(
  waContacts: WhatsAppContact[]
): Promise<{ status: 'ok' | 'denied'; contacts: MatchedContact[] }> {
  const perm = await ContactsLegacy.requestPermissionsAsync();
  if (perm.status !== 'granted') return { status: 'denied', contacts: [] };

  const { data } = await ContactsLegacy.getContactsAsync({
    fields: [ContactsLegacy.Fields.Name, ContactsLegacy.Fields.PhoneNumbers],
  });

  // Índice de números de WhatsApp por cada clave (sufijo) -> número internacional.
  const waIndex = new Map<string, string>();
  for (const c of waContacts) {
    for (const k of numberKeys(c.number)) {
      if (!waIndex.has(k)) waIndex.set(k, c.number);
    }
  }

  const out: MatchedContact[] = [];
  const seen = new Set<string>();

  for (const contact of data) {
    const name = (contact.name || '').trim();
    const phones = contact.phoneNumbers ?? [];
    for (const p of phones) {
      const raw = p.digits || p.number || '';
      // Buscamos si alguna clave de este teléfono está en WhatsApp.
      let intl: string | undefined;
      for (const k of numberKeys(raw)) {
        const hit = waIndex.get(k);
        if (hit) { intl = hit; break; }
      }
      if (!intl || seen.has(intl)) continue;
      seen.add(intl);
      out.push({ name: name || `+${intl}`, number: intl });
    }
  }

  out.sort((a, b) =>
    a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })
  );
  return { status: 'ok', contacts: out };
}
