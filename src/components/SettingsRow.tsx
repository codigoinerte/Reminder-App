import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';

type Props = {
  icon?: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  /** Componente a la derecha (ej: Switch). Si se pasa, ignora value/chevron. */
  right?: React.ReactNode;
  onPress?: () => void;
  danger?: boolean;
};

/** Fila reutilizable para listas de ajustes. */
export function SettingsRow({
  icon,
  label,
  value,
  right,
  onPress,
  danger,
}: Props) {
  const { colors } = useTheme();
  const labelColor = danger ? colors.danger : colors.text;

  const content = (
    <View style={[styles.row, { borderBottomColor: colors.border }]}>
      {icon && (
        <Ionicons
          name={icon}
          size={20}
          color={danger ? colors.danger : colors.textMuted}
          style={styles.icon}
        />
      )}
      <Text style={[styles.label, { color: labelColor }]}>{label}</Text>
      <View style={styles.rightWrap}>
        {right ?? (
          <>
            {value != null && (
              <Text style={[styles.value, { color: colors.textMuted }]}>
                {value}
              </Text>
            )}
            {onPress && (
              <Ionicons
                name="chevron-forward"
                size={18}
                color={colors.textMuted}
              />
            )}
          </>
        )}
      </View>
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => pressed && { opacity: 0.6 }}
      >
        {content}
      </Pressable>
    );
  }
  return content;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  icon: { marginRight: 12 },
  label: { fontSize: 16, flexShrink: 1 },
  rightWrap: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  value: { fontSize: 15 },
});
