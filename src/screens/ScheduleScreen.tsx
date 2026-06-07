import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { ScheduleCard } from '../components/ScheduleCard';
import { WeekStrip } from '../components/WeekStrip';
import * as api from '../api/client';
import type { Schedule } from '../types';
import { dayKey, dayLabel } from '../utils/format';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** Modo de listado: por día (con WeekStrip) o todos agrupados por fecha. */
type ViewMode = 'day' | 'all';

/**
 * Filas del FlatList en modo "Todos": encabezado de día o tarjeta. Permite una
 * lista plana con secciones por fecha (más simple que SectionList para
 * mantener el timeline con `isLast`).
 */
type Row =
  | { type: 'header'; key: string; label: string }
  | { type: 'card'; key: string; schedule: Schedule; isLast: boolean };

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function ScheduleScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());
  const [mode, setMode] = useState<ViewMode>('day');

  const load = useCallback(async () => {
    try {
      setSchedules(await api.listSchedules());
    } catch {
      Alert.alert('Error', 'No se pudieron cargar los recordatorios.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  // Días con recordatorios (para los puntos de la WeekStrip).
  const markedDays = useMemo(
    () => new Set(schedules.map((s) => dayKey(s.scheduleDate))),
    [schedules]
  );

  // ----- Modo "Día": recordatorios del día seleccionado, ordenados por hora.
  const dayItems = useMemo(
    () =>
      schedules
        .filter((s) => sameDay(new Date(s.scheduleDate), selectedDay))
        .sort((a, b) => a.scheduleDate.localeCompare(b.scheduleDate)),
    [schedules, selectedDay]
  );

  // ----- Modo "Todos": todos los recordatorios ordenados por fecha, con
  // encabezados de día intercalados. El timeline se reinicia por sección.
  const allRows = useMemo<Row[]>(() => {
    const sorted = [...schedules].sort((a, b) =>
      a.scheduleDate.localeCompare(b.scheduleDate)
    );
    const rows: Row[] = [];
    let currentKey = '';
    sorted.forEach((s, i) => {
      const key = dayKey(s.scheduleDate);
      if (key !== currentKey) {
        currentKey = key;
        rows.push({
          type: 'header',
          key: `h-${key}`,
          label: dayLabel(s.scheduleDate),
        });
      }
      // Es la última tarjeta de su día si el siguiente cambia de día (o no hay).
      const next = sorted[i + 1];
      const isLast = !next || dayKey(next.scheduleDate) !== key;
      rows.push({ type: 'card', key: s.id, schedule: s, isLast });
    });
    return rows;
  }, [schedules]);

  // Índice de la "próxima" tarjeta a destacar (solo en modo Día): el primer
  // recordatorio activo y futuro del día.
  const highlightIndex = useMemo(() => {
    const now = Date.now();
    return dayItems.findIndex(
      (s) => s.enabled && new Date(s.scheduleDate).getTime() >= now
    );
  }, [dayItems]);

  const isToday = sameDay(selectedDay, new Date());
  const headerDate = selectedDay.toLocaleDateString('es-PE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const headerTitle =
    mode === 'all'
      ? 'Todos'
      : isToday
        ? 'Hoy'
        : selectedDay.toLocaleDateString('es-PE', { weekday: 'long' });
  const headerSubtitle =
    mode === 'all'
      ? `${schedules.length} ${schedules.length === 1 ? 'recordatorio' : 'recordatorios'}`
      : headerDate;

  const handleToggle = async (item: Schedule, enabled: boolean) => {
    setSchedules((prev) =>
      prev.map((s) =>
        s.id === item.id
          ? { ...s, enabled, status: enabled ? 'scheduled' : 'disabled' }
          : s
      )
    );
    try {
      await api.toggleSchedule(item.id, enabled);
    } catch {
      Alert.alert('Error', 'No se pudo actualizar.');
      load();
    }
  };

  const openEdit = (item: Schedule) =>
    navigation.navigate('EditSchedule', { schedule: item });

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  // Header común a ambos modos: título + toggle Día/Todos + WeekStrip (solo Día).
  const listHeader = (
    <View style={{ paddingTop: insets.top + 12 }}>
      <View style={styles.header}>
        <Text style={[styles.date, { color: colors.textMuted }]}>
          {headerSubtitle}
        </Text>
        <View style={styles.titleRow}>
          <Text style={[styles.heading, { color: colors.text }]}>
            {headerTitle}
          </Text>
          <ModeToggle mode={mode} onChange={setMode} colors={colors} />
        </View>
      </View>
      {mode === 'day' && (
        <WeekStrip
          selected={selectedDay}
          onSelect={setSelectedDay}
          markedDays={markedDays}
        />
      )}
      <View style={{ height: 12 }} />
    </View>
  );

  const emptyComponent = (
    <View style={styles.empty}>
      <Ionicons name="calendar-outline" size={56} color={colors.textMuted} />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>
        {mode === 'all'
          ? 'Sin recordatorios'
          : isToday
            ? 'Nada para hoy'
            : 'Sin recordatorios'}
      </Text>
      <Text style={[styles.emptyText, { color: colors.textMuted }]}>
        Toca el botón + para crear un mensaje programado.
      </Text>
    </View>
  );

  const refreshControl = (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      tintColor={colors.primary}
    />
  );

  const contentPadding = { paddingBottom: insets.bottom + 110 };

  // ----- Modo "Todos": lista plana con encabezados de día.
  if (mode === 'all') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <FlatList
          data={allRows}
          keyExtractor={(row) => row.key}
          contentContainerStyle={contentPadding}
          refreshControl={refreshControl}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={emptyComponent}
          renderItem={({ item }) =>
            item.type === 'header' ? (
              <Text style={[styles.sectionHeader, { color: colors.textMuted }]}>
                {item.label}
              </Text>
            ) : (
              <ScheduleCard
                schedule={item.schedule}
                isLast={item.isLast}
                onPress={() => openEdit(item.schedule)}
                onToggle={(enabled) => handleToggle(item.schedule, enabled)}
              />
            )
          }
        />
      </View>
    );
  }

  // ----- Modo "Día": recordatorios del día seleccionado.
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={dayItems}
        keyExtractor={(item) => item.id}
        contentContainerStyle={contentPadding}
        refreshControl={refreshControl}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={emptyComponent}
        renderItem={({ item, index }) => (
          <ScheduleCard
            schedule={item}
            highlighted={index === highlightIndex}
            isLast={index === dayItems.length - 1}
            onPress={() => openEdit(item)}
            onToggle={(enabled) => handleToggle(item, enabled)}
          />
        )}
      />
    </View>
  );
}

/** Toggle segmentado Día / Todos. */
function ModeToggle({
  mode,
  onChange,
  colors,
}: {
  mode: ViewMode;
  onChange: (m: ViewMode) => void;
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  const options: { key: ViewMode; label: string }[] = [
    { key: 'day', label: 'Día' },
    { key: 'all', label: 'Todos' },
  ];
  return (
    <View style={[styles.toggle, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {options.map((o) => {
        const active = mode === o.key;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            style={[styles.toggleBtn, active && { backgroundColor: colors.primary }]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text
              style={[
                styles.toggleText,
                { color: active ? '#FFFFFF' : colors.textMuted },
              ]}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: 20, paddingBottom: 4 },
  date: { fontSize: 14, fontWeight: '500' },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  heading: { fontSize: 34, fontWeight: '800', flex: 1 },
  toggle: {
    flexDirection: 'row',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 3,
  },
  toggleBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 999,
  },
  toggleText: { fontSize: 14, fontWeight: '700' },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 10,
  },
  empty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginTop: 16 },
  emptyText: { fontSize: 14, textAlign: 'center', marginTop: 6, lineHeight: 20 },
});
