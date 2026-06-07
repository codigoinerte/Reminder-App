import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
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
  }

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>{content}</Stack.Navigator>
    </NavigationContainer>
  );
}
