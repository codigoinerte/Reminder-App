import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, View } from 'react-native';
import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
  useNavigation,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import * as Notifications from 'expo-notifications';
import * as api from '../api/client';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../theme/ThemeContext';
import { ScheduleScreen } from '../screens/ScheduleScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { EditScheduleScreen } from '../screens/EditScheduleScreen';
import { EntryScreen } from '../screens/auth/EntryScreen';
import { useAuth } from '../auth/AuthContext';
import { useConnection } from '../whatsapp/ConnectionContext';
import { CustomTabBar } from './CustomTabBar';
import type { RootStackParamList, TabsParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabsParamList>();

function Tabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Schedule" component={ScheduleScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

/**
 * Escucha taps en notificaciones locales y abre el detalle del recordatorio.
 * La notificación lleva `data.scheduleId`; como EditSchedule espera el objeto
 * Schedule completo, lo buscamos por id en la lista del backend antes de
 * navegar. Cubre dos casos: tap con la app abierta (listener) y app abierta
 * desde cero por la notificación (getLastNotificationResponseAsync).
 *
 * Solo se monta en el stack autenticado+conectado, que es donde existe la ruta
 * EditSchedule.
 */
function NotificationTapHandler() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  // Evita navegar dos veces al mismo id (listener + last-response al arrancar).
  const handled = useRef<string | null>(null);

  useEffect(() => {
    let active = true;

    const openSchedule = async (scheduleId: unknown) => {
      const id = typeof scheduleId === 'string' ? scheduleId : null;
      if (!id || handled.current === id) return;
      handled.current = id;
      try {
        const schedules = await api.listSchedules();
        const schedule = schedules.find((s) => s.id === id);
        if (active && schedule) {
          navigation.navigate('EditSchedule', { schedule });
        }
      } catch {
        // Si falla la carga (sin red), no abrimos nada; el usuario verá la lista.
      }
    };

    // App abierta desde cero tocando la notificación.
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        void openSchedule(
          response.notification.request.content.data?.scheduleId
        );
      }
    });

    // Tap con la app ya en ejecución.
    const sub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        void openSchedule(
          response.notification.request.content.data?.scheduleId
        );
      }
    );

    return () => {
      active = false;
      sub.remove();
    };
  }, [navigation]);

  return null;
}

function Splash() {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

export function RootNavigator() {
  const { isDark, colors } = useTheme();
  const { loading, isAuthenticated } = useAuth();
  const { checking, isConnected } = useConnection();

  const navTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme : DefaultTheme).colors,
      background: colors.background,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
      primary: colors.primary,
    },
  };

  // Restaurando sesión guardada.
  if (loading) return <Splash />;
  // Con sesión, mientras comprobamos el estado de WhatsApp por primera vez.
  if (isAuthenticated && checking) return <Splash />;

  // Decide qué stack mostrar:
  //  - sin sesión           -> entrada (número -> login/registro)
  //  - sesión + desconectado -> reconexión forzada
  //  - sesión + conectado    -> dashboard
  let content: React.ReactNode;
  let extras: React.ReactNode = null;
  if (!isAuthenticated) {
    content = <Stack.Screen name="Auth">{() => <EntryScreen mode="entry" />}</Stack.Screen>;
  } else if (!isConnected) {
    content = <Stack.Screen name="Auth">{() => <EntryScreen mode="reconnect" />}</Stack.Screen>;
  } else {
    content = (
      <>
        <Stack.Screen name="Tabs" component={Tabs} />
        <Stack.Screen
          name="EditSchedule"
          component={EditScheduleScreen}
          options={{ presentation: 'modal' }}
        />
      </>
    );
    extras = <NotificationTapHandler />;
  }

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>{content}</Stack.Navigator>
      {extras}
    </NavigationContainer>
  );
}
