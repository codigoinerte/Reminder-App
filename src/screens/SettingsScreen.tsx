import React, { useCallback } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { SettingsRow } from '../components/SettingsRow';
import * as api from '../api/client';
import type { ConnectionState } from '../types';
import { getDeviceTimezone } from '../utils/format';
import { useAuth } from '../auth/AuthContext';
import { useConnection } from '../whatsapp/ConnectionContext';

const STATE_LABEL: Record<ConnectionState, string> = {
  open: 'Conectado',
  connecting: 'Conectando…',
  close: 'Desconectado',
  unknown: 'Desconocido',
};

export function SettingsScreen() {
  const { colors, isDark, toggleDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { phone, signOut } = useAuth();
  const { state, refresh } = useConnection();
  const timezone = getDeviceTimezone();

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const stateColor = (s: ConnectionState) =>
    s === 'open' ? colors.success : s === 'connecting' ? colors.warning : colors.danger;

  // Cerrar sesión en la app (cambiar de cuenta): borra el token local.
  const onSignOut = () => {
    Alert.alert('Cerrar sesión', '¿Salir de esta cuenta en este dispositivo?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Salir', style: 'destructive', onPress: () => signOut() },
    ]);
  };

  // Desconectar WhatsApp en Evolution (sin borrar la cuenta/recordatorios).
  const onLogoutWhatsApp = () => {
    Alert.alert('Desconectar WhatsApp', '¿Desvincular tu WhatsApp? Tendrás que volver a vincularlo para enviar.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Desconectar',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.logoutWhatsApp();
            refresh();
          } catch {
            Alert.alert('Error', 'No se pudo desconectar.');
          }
        },
      },
    ]);
  };

  const onDeleteAccount = () => {
    Alert.alert(
      'Eliminar cuenta',
      'Esto elimina la instancia de WhatsApp y TODOS tus recordatorios. Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar todo',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteAccount();
              await signOut(); // la sesión ya no es válida
            } catch {
              Alert.alert('Error', 'No se pudo eliminar la cuenta.');
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
    >
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: 8 }}>
        <Text style={[styles.heading, { color: colors.text }]}>Ajustes</Text>
      </View>

      {/* Cuenta WhatsApp */}
      <Section title="Cuenta WhatsApp" colors={colors}>
        <SettingsRow
          icon="logo-whatsapp"
          label="Estado"
          right={
            <View style={styles.statusWrap}>
              <View style={[styles.dot, { backgroundColor: stateColor(state) }]} />
              <Text style={{ color: stateColor(state), fontWeight: '600' }}>
                {STATE_LABEL[state]}
              </Text>
            </View>
          }
        />
        <SettingsRow
          icon="call-outline"
          label="Número"
          value={phone ?? '—'}
        />
      </Section>

      {/* Preferencias */}
      <Section title="Preferencias" colors={colors}>
        <SettingsRow
          icon="moon-outline"
          label="Modo oscuro"
          right={
            <Switch
              value={isDark}
              onValueChange={toggleDark}
              trackColor={{ true: colors.primary, false: colors.border }}
              thumbColor="#FFFFFF"
            />
          }
        />
        <SettingsRow
          icon="globe-outline"
          label="Zona horaria"
          value={timezone}
        />
      </Section>

      {/* Sesión y conexión */}
      <Section title="Sesión" colors={colors}>
        <SettingsRow icon="swap-horizontal-outline" label="Cerrar sesión / cambiar cuenta" onPress={onSignOut} />
        <SettingsRow icon="log-out-outline" label="Desconectar WhatsApp" onPress={onLogoutWhatsApp} danger />
      </Section>

      {/* Zona peligrosa */}
      <Section title="Zona peligrosa" colors={colors}>
        <SettingsRow
          icon="trash-outline"
          label="Eliminar cuenta y datos"
          onPress={onDeleteAccount}
          danger
        />
      </Section>
    </ScrollView>
  );
}

function Section({
  title,
  colors,
  children,
}: {
  title: string;
  colors: ReturnType<typeof useTheme>['colors'];
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
        {title}
      </Text>
      <View
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 30, fontWeight: '800' },
  section: { marginTop: 18, paddingHorizontal: 16 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  statusWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 9, height: 9, borderRadius: 5 },
});
