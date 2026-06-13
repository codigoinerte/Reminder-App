/**
 * Contexto de conexión de WhatsApp (estado de la instancia del usuario logueado).
 *
 * Solo tiene sentido cuando hay sesión: hace polling de /whatsapp/status para
 * que el gate pueda forzar la reconexión si la instancia queda 'close'.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import * as api from '../api/client';
import type { ConnectionState } from '../types';
import { useAuth } from '../auth/AuthContext';

type ConnectionContextValue = {
  state: ConnectionState;
  checking: boolean;
  isConnected: boolean;
  forceReconnect: boolean;
  refresh: () => Promise<void>;
};

const ConnectionContext = createContext<ConnectionContextValue | undefined>(
  undefined
);

export function ConnectionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated } = useAuth();
  const [state, setState] = useState<ConnectionState>('unknown');
  const [checking, setChecking] = useState(true);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  // Cuántas veces consecutivas el estado NO fue 'open'. Solo forzamos la
  // pantalla de reconexión cuando esto llega a 2, evitando falsos positivos
  // por estados transitorios de Baileys al arrancar ('connecting', etc.).
  const notOpenCount = useRef(0);
  const [forceReconnect, setForceReconnect] = useState(false);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setState('unknown');
      setChecking(false);
      return;
    }
    try {
      const s = await api.getWhatsAppStatus();
      setState(s.state);
      if (s.state === 'open') {
        notOpenCount.current = 0;
        setForceReconnect(false);
      } else {
        notOpenCount.current += 1;
        // Solo forzar reconexión tras 2 polls sin 'open' (≈8 s), no en el primero.
        if (notOpenCount.current >= 2) setForceReconnect(true);
      }
    } catch {
      setState('unknown');
    } finally {
      setChecking(false);
    }
  }, [isAuthenticated]);

  // Al iniciar sesión: comprobar y hacer polling. Al cerrar: limpiar.
  useEffect(() => {
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
    if (isAuthenticated) {
      notOpenCount.current = 0;
      setForceReconnect(false);
      setChecking(true);
      refresh().finally(() => {
        timer.current = setInterval(refresh, 4000);
      });
    } else {
      setState('unknown');
      setForceReconnect(false);
      setChecking(false);
    }
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [isAuthenticated, refresh]);

  return (
    <ConnectionContext.Provider
      value={{ state, checking, isConnected: state === 'open', forceReconnect, refresh }}
    >
      {children}
    </ConnectionContext.Provider>
  );
}

export function useConnection() {
  const ctx = useContext(ConnectionContext);
  if (!ctx)
    throw new Error('useConnection debe usarse dentro de ConnectionProvider');
  return ctx;
}
