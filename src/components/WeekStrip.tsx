import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

type Props = {
  /** Día seleccionado (cualquier hora de ese día). */
  selected: Date;
  onSelect: (day: Date) => void;
  /** Días que tienen al menos un recordatorio (claves YYYY-MM-DD). */
  markedDays?: Set<string>;
};

const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function ymd(d: Date): string {
  return `${d.getFullYear()}-${(d.getMonth() + 1)
    .toString()
    .padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
}

/** Tira horizontal con la semana de `selected` (lunes a domingo). */
export function WeekStrip({ selected, onSelect, markedDays }: Props) {
  const { colors } = useTheme();

  const days = useMemo(() => {
    // Inicio de semana = lunes.
    const base = new Date(selected);
    const dow = (base.getDay() + 6) % 7; // 0 = lunes
    const monday = new Date(base);
    monday.setDate(base.getDate() - dow);
    monday.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d;
    });
  }, [selected]);

  const selectedKey = ymd(selected);

  return (
    <View style={styles.row}>
      {days.map((d) => {
        const key = ymd(d);
        const active = key === selectedKey;
        const hasItems = markedDays?.has(key);
        return (
          <Pressable
            key={key}
            onPress={() => onSelect(d)}
            style={styles.cell}
            hitSlop={4}
          >
            <Text
              style={[
                styles.dow,
                { color: active ? colors.primary : colors.textMuted },
              ]}
            >
              {DAY_LABELS[d.getDay()]}
            </Text>
            <Text
              style={[
                styles.num,
                {
                  color: active ? colors.primary : colors.text,
                  fontWeight: active ? '800' : '600',
                },
              ]}
            >
              {d.getDate()}
            </Text>
            <View
              style={[
                styles.dot,
                {
                  backgroundColor:
                    active || hasItems ? colors.primary : 'transparent',
                  opacity: active ? 1 : hasItems ? 0.5 : 0,
                },
              ]}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  cell: { alignItems: 'center', flex: 1, paddingVertical: 4 },
  dow: { fontSize: 13, marginBottom: 6 },
  num: { fontSize: 17 },
  dot: { width: 5, height: 5, borderRadius: 3, marginTop: 6 },
});
