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

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setState('unknown');
      setChecking(false);
      return;
    }
    try {
      const s = await api.getWhatsAppStatus();
      setState(s.state);
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
      setChecking(true);
      refresh();
      timer.current = setInterval(refresh, 4000);
    } else {
      setState('unknown');
      setChecking(false);
    }
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [isAuthenticated, refresh]);

  return (
    <ConnectionContext.Provider
      value={{ state, checking, isConnected: state === 'open', refresh }}
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
