/**
 * SQLite local SOLO para contactos usados como referente.
 *
 * Según el documento: no sincronizamos contactos al servidor. Cuando el usuario
 * elige un contacto del teléfono (expo-contacts) o lo escribe a mano, lo
 * guardamos aquí para reutilizarlo rápido la próxima vez.
 *
 * Los recordatorios NO viven aquí: viven en el backend (fuente de verdad).
 */
import * as SQLite from 'expo-sqlite';
import type { Contact } from '../types';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync('reminder_app.db').then(async (db) => {
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS contacts (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          number TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
      `);
      return db;
    });
  }
  return dbPromise;
}

export async function listContacts(): Promise<Contact[]> {
  const db = await getDb();
  return db.getAllAsync<Contact>(
    'SELECT id, name, number FROM contacts ORDER BY name COLLATE NOCASE ASC'
  );
}

/**
 * Guarda un contacto como referente. Deduplica por número normalizado:
 * si ya existe ese número, actualiza el nombre.
 */
export async function saveContact(
  name: string,
  number: string
): Promise<void> {
  const db = await getDb();
  const existing = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM contacts WHERE number = ?',
    [number]
  );
  if (existing) {
    await db.runAsync('UPDATE contacts SET name = ? WHERE id = ?', [
      name,
      existing.id,
    ]);
    return;
  }
  // id estable derivado del número (sin Math.random para evitar duplicados).
  const id = `c_${number}`;
  await db.runAsync(
    'INSERT INTO contacts (id, name, number, created_at) VALUES (?, ?, ?, ?)',
    [id, name, number, new Date().toISOString()]
  );
}

export async function deleteContact(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM contacts WHERE id = ?', [id]);
}
