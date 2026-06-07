# App — WhatsApp Scheduler

App móvil en **React Native + Expo (SDK 56)**, TypeScript. Iteramos primero en
**Android**.

## Configuración

```bash
cp .env.example .env
```

| Variable                   | Descripción                                                    |
| -------------------------- | -------------------------------------------------------------- |
| `EXPO_PUBLIC_API_BASE_URL` | URL del backend. **Emulador Android:** `http://10.0.2.2:3000`. **Dispositivo físico:** la IP LAN del PC (ej. `http://192.168.1.50:3000`). |
| `EXPO_PUBLIC_USE_MOCK`     | `true` = datos mock en memoria (UI sin backend). `false` = backend real. |

> Las variables `EXPO_PUBLIC_*` se inyectan automáticamente desde `.env` (no
> requiere config extra en SDK 56).

## Ejecutar

```bash
npm install
npx expo start          # luego pulsa "a" para Android
# o directamente:
npm run android
```

## Estructura

```
src/
  api/            cliente HTTP del backend (+ mock para iterar sin backend)
  components/     Button, Field, ScheduleCard, SettingsRow, ContactPicker
  data/           contactsDb.ts (SQLite local: contactos como referente)
  navigation/     RootNavigator (2 tabs + stack modal de crear/editar)
  screens/        ScheduleScreen, EditScheduleScreen, SettingsScreen
  theme/          colores light/dark + ThemeContext (dark mode persistente)
  utils/          formato de fechas, normalización de números, timezone
  config.ts       API_BASE_URL central
  types.ts        tipos del dominio
```

## Pantallas

- **Agenda (Schedule):** timeline diario de tarjetas redondeadas, FAB **+** para
  crear, switch por tarjeta para activar/desactivar, tap para editar/eliminar.
- **Crear/Editar:** título, mensaje, selector de contacto, date picker, time
  picker, repetición (una vez / diario / semanal / mensual), switch Activo.
- **Ajustes (Settings):** estado y número de WhatsApp, modo oscuro, zona horaria
  (autodetectada), reconectar, cerrar sesión, eliminar cuenta.

## Contactos

Usa el selector **nativo** del sistema (`Contact.presentPicker()` de
`expo-contacts`, API SDK 56). No se sincronizan contactos al servidor; el
elegido se guarda en SQLite local para reutilizarlo rápido. También se puede
ingresar nombre + número manualmente.

> El selector nativo de contactos **no funciona en Expo Go**: requiere un
> *development build* (`npx expo run:android`). La entrada manual sí funciona en
> Expo Go.

## Modo mock vs backend

Con `EXPO_PUBLIC_USE_MOCK=true` la app muestra datos de ejemplo y no llama al
backend — útil para revisar la UI. Cámbialo a `false` cuando el backend esté
corriendo (ver `../backend/README.md`).
