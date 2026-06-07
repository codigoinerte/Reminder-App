import React, { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';

type Props = {
  label: string;
  hint?: string;
} & TextInputProps;

/**
 * Campo de texto etiquetado con estilo de tarjeta.
 *
 * Si `secureTextEntry` está activo, muestra un botón de "ojo" para alternar la
 * visibilidad del contenido (ver/ocultar contraseña).
 */
export function Field({ label, hint, style, secureTextEntry, ...inputProps }: Props) {
  const { colors } = useTheme();
  const isSecret = !!secureTextEntry;
  const [reveal, setReveal] = useState(false);
  // Cuando el campo es secreto, lo ocultamos salvo que el usuario pulse el ojo.
  const hidden = isSecret && !reveal;

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      <View style={styles.inputRow}>
        <TextInput
          placeholderTextColor={colors.textMuted}
          {...inputProps}
          secureTextEntry={hidden}
          style={[
            styles.input,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              color: colors.text,
            },
            isSecret && styles.inputWithIcon,
            style,
          ]}
        />
        {isSecret && (
          <Pressable
            onPress={() => setReveal((v) => !v)}
            hitSlop={10}
            style={styles.eye}
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Mostrar contraseña' : 'Ocultar contraseña'}
          >
            <Ionicons
              name={hidden ? 'eye-outline' : 'eye-off-outline'}
              size={22}
              color={colors.textMuted}
            />
          </Pressable>
        )}
      </View>
      {hint && (
        <Text style={[styles.hint, { color: colors.textMuted }]}>{hint}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 18 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  inputRow: { justifyContent: 'center' },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    minHeight: 52,
  },
  // Espacio a la derecha para que el texto no quede bajo el ícono del ojo.
  inputWithIcon: { paddingRight: 48 },
  eye: {
    position: 'absolute',
    right: 8,
    height: 52,
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: { fontSize: 12, marginTop: 6 },
});
