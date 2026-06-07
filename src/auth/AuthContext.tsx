/**
 * Contexto de sesión. Identidad = número de WhatsApp.
 *
 * Guarda el JWT y el número en expo-secure-store (cifrado). El gate del
 * navegador muestra el dashboard solo si hay sesión.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import * as SecureStore from 'expo-secure-store';
import * as api from '../api/client';

const TOKEN_KEY = 'auth_token';
const PHONE_KEY = 'auth_phone';

type AuthContextValue = {
  /** true mientras se restaura la sesión guardada al iniciar. */
  loading: boolean;
  token: string | null;
  phone: string | null;
  isAuthenticated: boolean;
  register: (number: string, password: string) => Promise<void>;
  login: (number: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);

  // Restaurar sesión al iniciar.
  useEffect(() => {
    (async () => {
      try {
        const [t, p] = await Promise.all([
          SecureStore.getItemAsync(TOKEN_KEY),
          SecureStore.getItemAsync(PHONE_KEY),
        ]);
        if (t) {
          setToken(t);
          setPhone(p);
          api.setAuthToken(t);
        }
      } catch {
        /* sin sesión */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const persist = useCallback(async (t: string, p: string) => {
    api.setAuthToken(t);
    setToken(t);
    setPhone(p);
    await SecureStore.setItemAsync(TOKEN_KEY, t);
    await SecureStore.setItemAsync(PHONE_KEY, p);
  }, []);

  const register = useCallback(
    async (number: string, password: string) => {
      const { token: t, phone: p } = await api.authRegister(number, password);
      await persist(t, p);
    },
    [persist]
  );

  const login = useCallback(
    async (number: string, password: string) => {
      const { token: t, phone: p } = await api.authLogin(number, password);
      await persist(t, p);
    },
    [persist]
  );

  const signOut = useCallback(async () => {
    api.setAuthToken(null);
    setToken(null);
    setPhone(null);
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(PHONE_KEY);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        loading,
        token,
        phone,
        isAuthenticated: !!token,
        register,
        login,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
