import React from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { REPEAT_LABELS, type Schedule } from '../types';
import { formatTime } from '../utils/format';

type Props = {
  schedule: Schedule;
  onPress: () => void;
  onToggle: (enabled: boolean) => void;
  /** Resalta la tarjeta en azul (la "próxima" del día). */
  highlighted?: boolean;
  /** Oculta el segmento de línea inferior (última tarjeta). */
  isLast?: boolean;
};

const STATUS_META: Record<
  Schedule['status'],
  { label: string; colorKey: 'success' | 'textMuted' | 'danger' | 'warning' }
> = {
  scheduled: { label: 'Programado', colorKey: 'warning' },
  sent: { label: 'Enviado', colorKey: 'success' },
  failed: { label: 'Falló', colorKey: 'danger' },
  disabled: { label: 'Desactivado', colorKey: 'textMuted' },
};

export function ScheduleCard({
  schedule,
  onPress,
  onToggle,
  highlighted,
  isLast,
}: Props) {
  const { colors } = useTheme();
  const status = STATUS_META[schedule.status];
  const dimmed = !schedule.enabled;

  // Colores según destacada o no.
  const cardBg = highlighted ? colors.primary : colors.surface;
  const titleColor = highlighted ? '#FFFFFF' : colors.text;
  const subColor = highlighted ? 'rgba(255,255,255,0.85)' : colors.textMuted;
  const timeColor = highlighted ? '#FFFFFF' : colors.text;
  const statusColor = highlighted ? '#FFFFFF' : colors[status.colorKey];

  return (
    <View style={styles.wrap}>
      {/* Riel del timeline: nodo + línea */}
      <View style={styles.rail}>
        <View
          style={[
            styles.node,
            {
              borderColor: colors.primary,
              backgroundColor: highlighted ? colors.primary : colors.background,
            },
          ]}
        >
          {highlighted && <View style={styles.nodeInner} />}
        </View>
        {!isLast && (
          <View style={[styles.line, { backgroundColor: colors.border }]} />
        )}
      </View>

      {/* Tarjeta */}
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.card,
          {
            backgroundColor: cardBg,
            borderColor: highlighted ? colors.primary : colors.border,
            opacity: dimmed ? 0.55 : pressed ? 0.9 : 1,
          },
          highlighted && styles.cardElevated,
        ]}
      >
        <View style={styles.cardHeader}>
          <Text style={[styles.title, { color: titleColor }]} numberOfLines={1}>
            {schedule.title}
          </Text>
          <Text style={[styles.time, { color: timeColor }]}>
            {formatTime(schedule.scheduleDate)}
          </Text>
        </View>

        <Text style={[styles.message, { color: subColor }]} numberOfLines={2}>
          {schedule.message}
        </Text>

        <View style={styles.footer}>
          <View style={styles.dest}>
            <Ionicons name="person-circle-outline" size={16} color={subColor} />
            <Text style={[styles.destText, { color: subColor }]}>
              {schedule.contactName}
            </Text>
            {schedule.repeatType !== 'once' && (
              <View style={styles.repeatBadge}>
                <Ionicons name="repeat" size={13} color={subColor} />
                <Text style={[styles.repeatText, { color: subColor }]}>
                  {REPEAT_LABELS[schedule.repeatType]}
                </Text>
              </View>
            )}
          </View>

          {/* En destacada mostramos el switch en blanco; en normal, pill de estado + switch */}
          <View style={styles.rightFooter}>
            {!highlighted && (
              <Text style={[styles.statusText, { color: statusColor }]}>
                {status.label}
              </Text>
            )}
            <Switch
              value={schedule.enabled}
              onValueChange={onToggle}
              trackColor={{
                true: highlighted ? 'rgba(255,255,255,0.5)' : colors.primary,
                false: highlighted ? 'rgba(255,255,255,0.3)' : colors.border,
              }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>
      </Pressable>
    </View>
  );
}

const NODE = 18;

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  rail: {
    width: 28,
    alignItems: 'center',
    paddingTop: 18,
  },
  node: {
    width: NODE,
    height: NODE,
    borderRadius: NODE / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  line: {
    width: 2,
    flex: 1,
    marginTop: 4,
    borderRadius: 1,
  },
  card: {
    flex: 1,
    marginLeft: 10,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
  },
  cardElevated: {
    borderWidth: 0,
    shadowColor: '#5B9DFF',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: { fontSize: 16, fontWeight: '700', flex: 1 },
  time: { fontSize: 14, fontWeight: '700' },
  message: { fontSize: 14, marginTop: 5, lineHeight: 20 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  dest: { flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1 },
  destText: { fontSize: 13 },
  repeatBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, marginLeft: 6 },
  repeatText: { fontSize: 12 },
  rightFooter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusText: { fontSize: 12, fontWeight: '600' },
});
