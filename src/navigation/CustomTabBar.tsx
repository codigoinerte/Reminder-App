import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../theme/ThemeContext';
import type { RootStackParamList } from './types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * Tab bar personalizada con el botón "+" integrado al centro de la barra.
 * El botón se asienta sobre la barra (mitad sobresale) con sombra azul difusa,
 * imitando la referencia de diseño.
 */
export function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const rootNav = useNavigation<Nav>();

  const icons: Record<string, { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }> = {
    Schedule: { active: 'time', inactive: 'time-outline' },
    Settings: { active: 'person', inactive: 'person-outline' },
  };

  const go = (routeName: string, index: number) => {
    const isFocused = state.index === index;
    const event = navigation.emit({
      type: 'tabPress',
      target: state.routes[index].key,
      canPreventDefault: true,
    });
    if (!isFocused && !event.defaultPrevented) {
      navigation.navigate(routeName);
    }
  };

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          paddingBottom: insets.bottom,
          height: 64 + insets.bottom,
        },
      ]}
    >
      {/* Icono izquierdo */}
      <Pressable
        style={styles.side}
        onPress={() => go(state.routes[0].name, 0)}
        hitSlop={10}
      >
        <Ionicons
          name={
            state.index === 0
              ? icons[state.routes[0].name].active
              : icons[state.routes[0].name].inactive
          }
          size={26}
          color={state.index === 0 ? colors.primary : colors.textMuted}
        />
      </Pressable>

      {/* Botón central integrado */}
      <View style={styles.centerSlot} pointerEvents="box-none">
        <Pressable
          onPress={() => rootNav.navigate('EditSchedule')}
          style={({ pressed }) => [
            styles.fab,
            {
              backgroundColor: colors.primary,
              borderColor: colors.surface,
              transform: [{ scale: pressed ? 0.94 : 1 }],
            },
          ]}
        >
          <Ionicons name="add" size={30} color={colors.fabText} />
        </Pressable>
      </View>

      {/* Icono derecho */}
      <Pressable
        style={styles.side}
        onPress={() => go(state.routes[1].name, 1)}
        hitSlop={10}
      >
        <Ionicons
          name={
            state.index === 1
              ? icons[state.routes[1].name].active
              : icons[state.routes[1].name].inactive
          }
          size={26}
          color={state.index === 1 ? colors.primary : colors.textMuted}
        />
      </Pressable>
    </View>
  );
}

const FAB = 58;

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 14,
  },
  side: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 4,
  },
  // Reserva el espacio central y permite que el botón sobresalga hacia arriba.
  centerSlot: {
    width: FAB + 24,
    alignItems: 'center',
  },
  fab: {
    width: FAB,
    height: FAB,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    // El botón sube para "asentarse" sobre la barra, mitad sobresaliendo.
    marginTop: -28,
    // Borde del color de la barra para el efecto de muesca.
    borderWidth: 5,
    // Sombra azul difusa.
    shadowColor: '#5B9DFF',
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
});
