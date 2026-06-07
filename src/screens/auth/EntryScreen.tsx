import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { Field } from '../../components/Field';
import { Button } from '../../components/Button';
import { useAuth } from '../../auth/AuthContext';
import { useConnection } from '../../whatsapp/ConnectionContext';
import * as api from '../../api/client';

/**
 * Pantalla única de entrada. Flujo lineal de 3 pasos, idéntico tanto para
 * un usuario nuevo como para reconexión de un usuario ya logueado:
 *
 *   1. number   -> pide el número y consulta /auth/state
 *   2. password -> pide la contraseña (login) o crea una nueva (registro)
 *   3. pairing  -> pide vincular WhatsApp; el pairing code SOLO se genera
 *                  cuando el usuario llega aquí y presiona "Generar código",
 *                  para que no expire mientras lee las instrucciones.
 *
 * El paso 3 se omite si WhatsApp ya está 'open' (no hace falta vincular).
 *
 * mode:
 *  - 'entry'     (sin sesión): empieza en el paso 1 (número).
 *  - 'reconnect' (con sesión, WhatsApp 'close'): salta directo al paso 3
 *    usando el número de la sesión; no vuelve a pedir contraseña.
 */
type Props = { mode: 'entry' | 'reconnect' };

type Phase =
  | 'number' // 1. pedir número
  | 'password' // 2. contraseña (login, registrado)
  | 'setPassword' // 2. crear contraseña (nuevo)
  | 'pairing'; // 3. vincular WhatsApp (code bajo demanda)

export function EntryScreen({ mode }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { login, register, phone: sessionPhone } = useAuth();
  const { refresh: refreshConn } = useConnection();

  const [phase, setPhase] = useState<Phase>(mode === 'reconnect' ? 'pairing' : 'number');
  // En reconexión el número viene de la sesión.
  const [number, setNumber] = useState(mode === 'reconnect' ? sessionPhone ?? '' : '');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Cómo terminar el paso 3 cuando WhatsApp quede 'open':
  //  - 'register': es un usuario nuevo, tras vincular creamos su cuenta.
  //  - 'enter':    ya tiene sesión (login o reconexión), solo refrescamos.
  const finish = useRef<'register' | 'enter'>(mode === 'reconnect' ? 'enter' : 'register');
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPoll = () => {
    if (poll.current) {
      clearInterval(poll.current);
      poll.current = null;
    }
  };
  useEffect(() => () => stopPoll(), []);

  // ---- Paso 1: número -> decidir flujo según estado ----
  const onSubmitNumber = async () => {
    const digits = number.replace(/[^\d]/g, '');
    if (digits.length !== 9 && digits.length < 10) {
      setError('Ingresa tu número (9 dígitos) o con código de país.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const st = await api.authState(number);
      if (st.registered) {
        setPhase('password'); // ya tiene cuenta -> login
      } else {
        setPhase('setPassword'); // nuevo -> crear contraseña
      }
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo conectar. ¿Backend y Evolution activos?');
    } finally {
      setLoading(false);
    }
  };

  // ---- Paso 2 (registrado): login con contraseña ----
  const onLogin = async () => {
    if (!password) {
      setError('Ingresa tu contraseña.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await login(number, password); // setea sesión
      const st = await api.authState(number);
      if (st.state === 'open') {
        // Ya conectado: entramos directo, sin paso de pairing.
        await refreshConn();
      } else {
        // Falta vincular: pasamos al paso 3 (code bajo demanda).
        finish.current = 'enter';
        setPairingCode(null);
        setPhase('pairing');
      }
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo iniciar sesión.');
    } finally {
      setLoading(false);
    }
  };

  // ---- Paso 2 (nuevo): validar contraseña localmente y pasar al pairing ----
  const onSetPassword = () => {
    if (password.length < 4) {
      setError('La contraseña debe tener al menos 4 caracteres.');
      return;
    }
    if (password !== password2) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setError(null);
    // No registramos todavía: primero hay que vincular WhatsApp. La contraseña
    // se guarda en register() cuando la instancia quede 'open'.
    finish.current = 'register';
    setPairingCode(null);
    setPhase('pairing');
  };

  // ---- Paso 3: generar el pairing code BAJO DEMANDA ----
  const onGenerateCode = async () => {
    setError(null);
    setCopied(false); // un código nuevo invalida el "¡Copiado!" anterior
    setGenerating(true);
    try {
      // Para reconexión / login usamos el endpoint autenticado; para un usuario
      // nuevo (sin token aún) usamos /auth/connect.
      const res =
        finish.current === 'enter'
          ? await api.reconnectWhatsApp()
          : await api.authConnect(number);

      if (res.state === 'open') {
        // Ya estaba conectado mientras tanto: terminamos sin code.
        await completeOpen();
        return;
      }
      setPairingCode(res.pairingCode);
      pollUntilOpen();
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo generar el código.');
    } finally {
      setGenerating(false);
    }
  };

  // Acción al confirmarse la vinculación ('open').
  const completeOpen = async () => {
    if (finish.current === 'register') {
      await register(number, password); // crea cuenta + sesión -> gate entra
    } else {
      await refreshConn(); // login/reconexión -> gate entra
    }
  };

  // Polling hasta que la instancia quede 'open'.
  const pollUntilOpen = () => {
    stopPoll();
    poll.current = setInterval(async () => {
      try {
        // Si ya hay sesión (enter) consultamos /whatsapp/status; si no, /auth/state.
        const open =
          finish.current === 'enter'
            ? (await api.getWhatsAppStatus()).state === 'open'
            : (await api.authState(number)).state === 'open';
        if (open) {
          stopPoll();
          await completeOpen();
        }
      } catch {
        /* reintenta */
      }
    }, 3000);
  };

  const backToNumber = () => {
    stopPoll();
    setPassword('');
    setPassword2('');
    setPairingCode(null);
    setError(null);
    setPhase('number');
  };

  // Copiar el pairing code al portapapeles (para pegarlo en WhatsApp).
  const onCopyCode = async () => {
    if (!pairingCode) return;
    // Quitamos guiones/espacios: WhatsApp pide solo los caracteres del código.
    await Clipboard.setStringAsync(pairingCode.replace(/[\s-]/g, ''));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Cancelar la vinculación en curso: parar el polling, limpiar el código y
  // pedirle al backend que borre la instancia temporal en Evolution (corta el
  // bucle de reconexión de Baileys de inmediato). Volvemos al estado previo.
  const onCancelPairing = async () => {
    stopPoll();
    setError(null);
    setCanceling(true);
    const target = number; // la instancia se identifica por número
    setPairingCode(null);
    try {
      await api.authCancel(target);
    } catch {
      // Si falla el borrado remoto no bloqueamos al usuario: DEL_TEMP_INSTANCES
      // limpiará la instancia en el próximo restart de Evolution.
    } finally {
      setCanceling(false);
    }
  };

  // Retroceder al paso anterior. La cadena depende de cómo llegamos al paso 3:
  //  - registro nuevo:  pairing -> setPassword -> number
  //  - login:           pairing -> password    -> number
  //  - reconexión:      no hay paso previo (el paso 3 es el único).
  const goBack = async () => {
    if (phase === 'pairing') {
      // Si hay un código activo, lo cancelamos primero (limpia instancia).
      if (pairingCode || generating) await onCancelPairing();
      stopPoll();
      setPairingCode(null);
      setError(null);
      setPhase(finish.current === 'register' ? 'setPassword' : 'password');
      return;
    }
    // password / setPassword -> number
    backToNumber();
  };

  // ¿Mostramos el botón "Atrás"? No en el paso 1, ni en reconexión (paso único).
  const canGoBack = phase !== 'number' && !(mode === 'reconnect' && phase === 'pairing');

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          padding: 24,
          paddingTop: insets.top + 40,
          paddingBottom: insets.bottom + 24,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Barra superior: botón Atrás (no en el paso 1 ni en reconexión). */}
        {canGoBack && (
          <Pressable
            onPress={goBack}
            hitSlop={10}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel="Volver al paso anterior"
          >
            <Ionicons name="chevron-back" size={22} color={colors.text} />
            <Text style={[styles.backText, { color: colors.text }]}>Atrás</Text>
          </Pressable>
        )}

        <View style={styles.hero}>
          <View style={[styles.logo, { backgroundColor: colors.primary }]}>
            <Ionicons name="logo-whatsapp" size={40} color="#FFFFFF" />
          </View>
          <StepDots phase={phase} colors={colors} />
          <Text style={[styles.title, { color: colors.text }]}>{titleFor(phase)}</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            {subtitleFor(phase, mode)}
          </Text>
        </View>

        {/* Paso 1: número */}
        {phase === 'number' && (
          <View>
            <Field
              label="Tu número de WhatsApp"
              value={number}
              onChangeText={setNumber}
              placeholder="999 999 999"
              keyboardType="phone-pad"
              hint="Solo los 9 dígitos (Perú +51) o el número completo con código de país."
            />
            {error && <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>}
            <Button title="Continuar" onPress={onSubmitNumber} loading={loading} style={{ marginTop: 8 }} />
          </View>
        )}

        {/* Paso 2: login */}
        {phase === 'password' && (
          <View>
            <Field
              label={`Contraseña de ${number}`}
              value={password}
              onChangeText={setPassword}
              placeholder="Tu contraseña"
              secureTextEntry
            />
            {error && <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>}
            <Button title="Continuar" onPress={onLogin} loading={loading} style={{ marginTop: 8 }} />
          </View>
        )}

        {/* Paso 2: crear contraseña */}
        {phase === 'setPassword' && (
          <View>
            <Field label="Contraseña" value={password} onChangeText={setPassword} placeholder="Mínimo 4 caracteres" secureTextEntry />
            <Field label="Repite la contraseña" value={password2} onChangeText={setPassword2} placeholder="Repite tu contraseña" secureTextEntry />
            {error && <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>}
            <Button title="Continuar" onPress={onSetPassword} style={{ marginTop: 8 }} />
          </View>
        )}

        {/* Paso 3: vincular WhatsApp (code bajo demanda) */}
        {phase === 'pairing' && (
          <View>
            <View style={[styles.steps, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {[
                'Abre WhatsApp en tu teléfono.',
                'Ajustes → Dispositivos vinculados.',
                'Vincular un dispositivo → Vincular con número.',
                'Genera el código abajo e ingrésalo.',
              ].map((t, i) => (
                <View key={i} style={styles.stepRow}>
                  <View style={[styles.stepNum, { backgroundColor: colors.primary }]}>
                    <Text style={styles.stepNumText}>{i + 1}</Text>
                  </View>
                  <Text style={[styles.stepText, { color: colors.text }]}>{t}</Text>
                </View>
              ))}
            </View>

            {!pairingCode ? (
              <>
                {error && <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>}
                <Button
                  title="Generar código"
                  onPress={onGenerateCode}
                  loading={generating}
                  style={{ marginTop: 20 }}
                />
                <Text style={[styles.hintText, { color: colors.textMuted }]}>
                  Ten WhatsApp listo en el paso de "Vincular con número" antes de
                  generarlo: el código caduca en pocos segundos.
                </Text>
              </>
            ) : (
              <>
                {/* Tarjeta del código: dígitos grandes + botón copiar. */}
                <View
                  style={[
                    styles.codeBox,
                    { backgroundColor: colors.primary + '12', borderColor: colors.primary },
                  ]}
                >
                  <Text style={[styles.codeLabel, { color: colors.textMuted }]}>
                    Tu código de vinculación
                  </Text>
                  <Text style={[styles.code, { color: colors.primary }]} selectable>
                    {pairingCode}
                  </Text>

                  <Pressable
                    onPress={onCopyCode}
                    style={({ pressed }) => [
                      styles.copyBtn,
                      {
                        backgroundColor: copied ? colors.primary : colors.primary + '22',
                        borderColor: colors.primary,
                      },
                      pressed && { opacity: 0.8 },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Copiar código"
                  >
                    <Ionicons
                      name={copied ? 'checkmark' : 'copy-outline'}
                      size={18}
                      color={copied ? '#FFFFFF' : colors.primary}
                    />
                    <Text
                      style={[
                        styles.copyText,
                        { color: copied ? '#FFFFFF' : colors.primary },
                      ]}
                    >
                      {copied ? '¡Copiado!' : 'Copiar código'}
                    </Text>
                  </Pressable>
                </View>

                <View style={styles.waiting}>
                  <ActivityIndicator color={colors.primary} />
                  <Text style={[styles.waitingText, { color: colors.textMuted }]}>
                    Esperando vinculación…
                  </Text>
                </View>

                {error && <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>}

                <Button
                  title="Generar otro código"
                  onPress={onGenerateCode}
                  loading={generating}
                  variant="secondary"
                  style={{ marginTop: 16 }}
                />
                <Button
                  title="Cancelar"
                  onPress={onCancelPairing}
                  loading={canceling}
                  variant="ghost"
                />
              </>
            )}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** Indicador de progreso 3 pasos. */
function StepDots({ phase, colors }: { phase: Phase; colors: ReturnType<typeof useTheme>['colors'] }) {
  const step = phase === 'number' ? 1 : phase === 'pairing' ? 3 : 2;
  return (
    <View style={styles.dots}>
      {[1, 2, 3].map((n) => (
        <View
          key={n}
          style={[
            styles.dot,
            { backgroundColor: n <= step ? colors.primary : colors.border },
            n === step && styles.dotActive,
          ]}
        />
      ))}
    </View>
  );
}

function titleFor(phase: Phase): string {
  switch (phase) {
    case 'password':
      return 'Iniciar sesión';
    case 'setPassword':
      return 'Crea tu contraseña';
    case 'pairing':
      return 'Vincula tu WhatsApp';
    default:
      return 'Bienvenido';
  }
}

function subtitleFor(phase: Phase, mode: 'entry' | 'reconnect'): string {
  switch (phase) {
    case 'number':
      return 'Ingresa tu número de WhatsApp para empezar o iniciar sesión.';
    case 'password':
      return 'Este número ya tiene cuenta. Ingresa tu contraseña.';
    case 'setPassword':
      return 'Define una contraseña para tu cuenta. La usarás para iniciar sesión.';
    case 'pairing':
      return mode === 'reconnect'
        ? 'Tu WhatsApp se desconectó. Vincúlalo de nuevo cuando estés listo.'
        : 'Último paso: vincula tu WhatsApp. Genera el código cuando estés listo.';
    default:
      return '';
  }
}

const styles = StyleSheet.create({
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: 4,
    paddingVertical: 6,
    paddingRight: 12,
    gap: 2,
  },
  backText: { fontSize: 16, fontWeight: '600' },
  hero: { alignItems: 'center', marginBottom: 32 },
  logo: { width: 80, height: 80, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  dots: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotActive: { width: 22 },
  title: { fontSize: 24, fontWeight: '800', textAlign: 'center' },
  subtitle: { fontSize: 15, textAlign: 'center', marginTop: 8, lineHeight: 21, paddingHorizontal: 10 },
  steps: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 14 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepNum: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  stepText: { fontSize: 14, flex: 1, lineHeight: 19 },
  hintText: { fontSize: 13, textAlign: 'center', marginTop: 12, lineHeight: 18, paddingHorizontal: 8 },
  codeBox: { marginTop: 20, borderRadius: 16, borderWidth: 1, paddingVertical: 22, paddingHorizontal: 16, alignItems: 'center' },
  codeLabel: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, textAlign: 'center' },
  code: { fontSize: 38, fontWeight: '800', letterSpacing: 6, marginTop: 8 },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 999,
    borderWidth: 1,
  },
  copyText: { fontSize: 14, fontWeight: '700' },
  waiting: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 16 },
  waitingText: { fontSize: 14 },
  error: { fontSize: 13, marginTop: 10, textAlign: 'center' },
});
