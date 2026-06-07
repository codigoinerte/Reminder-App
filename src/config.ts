/**
 * Configuración central de la app.
 *
 * Cambia el entorno editando el archivo `.env` en la raíz de /app:
 *
 *   EXPO_PUBLIC_API_BASE_URL=http://192.168.1.50:3000
 *
 * Expo SDK 56 inyecta automáticamente las variables con prefijo EXPO_PUBLIC_
 * desde .env en process.env durante el bundling. No requiere config extra.
 *
 * IMPORTANTE (Android):
 *  - Un dispositivo físico o emulador NO ve "localhost" del PC.
 *  - Dispositivo físico: usa la IP LAN del PC, ej. http://192.168.1.50:3000
 *  - Emulador Android: http://10.0.2.2:3000 apunta al localhost del PC.
 *
 * La app solo habla con NUESTRO backend; el backend habla con Evolution API.
 * Por eso la apikey de Evolution vive en el .env del backend, no aquí.
 */

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://10.0.2.2:3000';

export const APP_NAME = 'WhatsApp Scheduler';
