import 'react-native-gesture-handler';
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import { AuthProvider } from './src/auth/AuthContext';
import { ConnectionProvider } from './src/whatsapp/ConnectionContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { configureNotificationHandler } from './src/notifications/local';

// Presentación de notificaciones locales en primer plano. Se registra una sola
// vez a nivel de módulo (antes de cualquier render) como recomienda expo.
configureNotificationHandler();

function ThemedStatusBar() {
  const { isDark } = useTheme();
  return <StatusBar style={isDark ? 'light' : 'dark'} />;
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <ThemedStatusBar />
          <AuthProvider>
            <ConnectionProvider>
              <RootNavigator />
            </ConnectionProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
