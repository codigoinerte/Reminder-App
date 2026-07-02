import React, { useEffect, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { Field } from '../components/Field';
import { Button } from '../components/Button';
import { ContactPicker } from '../components/ContactPicker';
import * as api from '../api/client';
import {
  scheduleReminderNotification,
  cancelReminderNotification,
  hasReminderNotification,
} from '../notifications/local';
import { REPEAT_LABELS, type RepeatType, type ScheduleInput } from '../types';
import { formatDate, formatTime, WEEKDAY_LABELS } from '../utils/format';
import type { RootStackParamList } from '../navigation/types';

const REPEAT_OPTIONS: RepeatType[] = ['once', 'daily', 'weekly', 'monthly', 'custom'];

/** Franja horaria en edición: hora local + su mensaje propio (si aplica). */
type TimeSlot = { date: Date; message: string };

/** Construye un Date (hora local) desde una hora guardada en UTC. */
function slotFromUtc(hour: number, minute: number, message: string | null): TimeSlot {
  const d = new Date();
  d.setUTCHours(hour, minute, 0, 0);
  return { date: d, message: message ?? '' };
}

export function EditScheduleScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'EditSchedule'>>();
  const editing = route.params?.schedule;

  const [title, setTitle] = useState(editing?.title ?? '');
  const [message, setMessage] = useState(editing?.message ?? '');
  const [contactName, setContactName] = useState(editing?.contactName ?? '');
  const [contactNumber, setContactNumber] = useState(
    editing?.contactNumber ?? ''
  );
  const [date, setDate] = useState<Date>(
    editing ? new Date(editing.scheduleDate) : defaultDate()
  );
  const [repeatType, setRepeatType] = useState<RepeatType>(
    editing?.repeatType ?? 'once'
  );
  // Horas del recordatorio (≥1). Cada una con su hora local y mensaje propio.
  const [times, setTimes] = useState<TimeSlot[]>(
    editing && editing.times.length > 0
      ? editing.times.map((t) => slotFromUtc(t.hour, t.minute, t.message))
      : [{ date: defaultDate(), message: '' }]
  );
  // Toggle "mismo mensaje en todas las horas".
  const [sameMessage, setSameMessage] = useState(editing?.sameMessage ?? true);
  // Días de semana (0=domingo..6=sábado); solo aplica a 'custom'.
  const [weekDays, setWeekDays] = useState<number[]>(editing?.weekDays ?? []);
  // Índice de la franja cuyo time-picker está abierto (o null).
  const [timePickerIndex, setTimePickerIndex] = useState<number | null>(null);
  // Variantes de mensaje (solo repetitivos). El server rota entre estas y el
  // mensaje principal para que el texto no sea idéntico cada vez (anti-baneo).
  const [variants, setVariants] = useState<string[]>(
    editing?.messageVariants ?? []
  );
  const [enabled, setEnabled] = useState(editing?.enabled ?? true);
  // Notificación LOCAL en este teléfono (no se sincroniza ni la dispara el
  // backend). Al editar, refleja si ya hay una programada en este dispositivo.
  const [notify, setNotify] = useState(!editing);

  const [showDate, setShowDate] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  function defaultDate(): Date {
    const d = new Date();
    d.setMinutes(d.getMinutes() + 5, 0, 0);
    return d;
  }

  // Al abrir en modo edición, consultamos si este teléfono ya tiene programada
  // la notificación local de este recordatorio para reflejarlo en el switch.
  useEffect(() => {
    if (!editing) return;
    let active = true;
    hasReminderNotification(editing.id).then((has) => {
      if (active) setNotify(has);
    });
    return () => {
      active = false;
    };
  }, [editing]);

  const onChangeDate = (_: unknown, selected?: Date) => {
    setShowDate(Platform.OS === 'ios');
    if (selected) {
      const next = new Date(date);
      next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
      setDate(next);
    }
  };

  const onChangeTime = (_: unknown, selected?: Date) => {
    const idx = timePickerIndex;
    if (Platform.OS !== 'ios') setTimePickerIndex(null);
    if (selected && idx != null) {
      setTimes((prev) =>
        prev.map((t, i) => {
          if (i !== idx) return t;
          const next = new Date(t.date);
          next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
          return { ...t, date: next };
        })
      );
    }
  };

  const addTime = () => {
    setTimes((prev) => {
      // Nueva franja: última hora + 1h (o default si no hay).
      const base = prev.length ? new Date(prev[prev.length - 1].date) : defaultDate();
      base.setHours(base.getHours() + 1);
      return [...prev, { date: base, message: '' }];
    });
  };

  const removeTime = (idx: number) => {
    setTimes((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));
  };

  const toggleWeekDay = (d: number) => {
    setWeekDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()
    );
  };

  /** Instante (anchor date + hora local de la franja) para validar 'once'. */
  const instantForSlot = (slot: TimeSlot): number => {
    const d = new Date(date);
    d.setHours(slot.date.getHours(), slot.date.getMinutes(), 0, 0);
    return d.getTime();
  };

  const validate = (): string | null => {
    if (!title.trim()) return 'El título es obligatorio.';
    if (!message.trim()) return 'El mensaje es obligatorio.';
    if (!contactNumber) return 'Debes elegir un destinatario.';
    if (times.length === 0) return 'Añade al menos una hora.';
    if (repeatType === 'custom' && weekDays.length === 0)
      return 'Elige al menos un día de la semana.';
    if (
      repeatType === 'once' &&
      times.every((t) => instantForSlot(t) < Date.now())
    )
      return 'Todas las horas ya pasaron. Elige una futura.';
    return null;
  };

  const onSave = async () => {
    const error = validate();
    if (error) {
      Alert.alert('Revisa los datos', error);
      return;
    }
    const input: ScheduleInput = {
      title: title.trim(),
      message: message.trim(),
      contactName: contactName.trim(),
      contactNumber,
      scheduleDate: date.toISOString(),
      repeatType,
      enabled,
      weekDays: repeatType === 'custom' ? weekDays : [],
      sameMessage,
      // Horas en UTC (la app trabaja en local; el backend en UTC).
      times: times.map((t) => ({
        hour: t.date.getUTCHours(),
        minute: t.date.getUTCMinutes(),
        message: sameMessage ? null : t.message.trim() || null,
      })),
      // Solo enviamos variantes en repetitivos; limpiamos vacías.
      messageVariants:
        repeatType === 'once'
          ? []
          : variants.map((v) => v.trim()).filter((v) => v.length > 0),
    };
    setSaving(true);
    try {
      const saved = editing
        ? await api.updateSchedule(editing.id, input)
        : await api.createSchedule(input);

      // Notificación local en este teléfono: programar o cancelar según el
      // switch. No bloquea el guardado si falla el permiso/programación.
      if (notify) {
        const ok = await scheduleReminderNotification({
          scheduleId: saved.id,
          title: saved.title,
          baseMessage: saved.message,
          sameMessage: saved.sameMessage,
          times: saved.times.map((t) => ({
            hour: t.hour,
            minute: t.minute,
            message: t.message,
          })),
          weekDays: saved.weekDays,
          anchor: new Date(saved.scheduleDate),
          repeatType: saved.repeatType,
        });
        if (!ok) {
          Alert.alert(
            'Notificación no activada',
            'El recordatorio se guardó, pero no se pudo programar la notificación local porque no diste permiso de notificaciones.'
          );
        }
      } else {
        await cancelReminderNotification(saved.id);
      }

      navigation.goBack();
    } catch {
      Alert.alert('Error', 'No se pudo guardar el recordatorio.');
    } finally {
      setSaving(false);
    }
  };

  const onDelete = () => {
    if (!editing) return;
    Alert.alert('Eliminar recordatorio', '¿Seguro que quieres eliminarlo?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteSchedule(editing.id);
            await cancelReminderNotification(editing.id);
            navigation.goBack();
          } catch {
            Alert.alert('Error', 'No se pudo eliminar.');
          }
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
          <Ionicons name="close" size={26} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {editing ? 'Editar recordatorio' : 'Nuevo recordatorio'}
        </Text>
        {editing ? (
          <Pressable onPress={onDelete} hitSlop={10}>
            <Ionicons name="trash-outline" size={24} color={colors.danger} />
          </Pressable>
        ) : (
          <View style={{ width: 26 }} />
        )}
      </View>

      <KeyboardAwareScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid
        extraScrollHeight={20}
      >
        <Field
          label="Título"
          value={title}
          onChangeText={setTitle}
          placeholder="Recordar medicina"
        />

        <Field
          label="Mensaje"
          value={message}
          onChangeText={setMessage}
          placeholder="Hola, recuerda tomar tu medicina."
          multiline
          numberOfLines={3}
          style={{ minHeight: 90, textAlignVertical: 'top' }}
        />

        {/* Destinatario */}
        <Text style={[styles.label, { color: colors.text }]}>Destinatario</Text>
        <Pressable
          onPress={() => setPickerVisible(true)}
          style={({ pressed }) => [
            styles.selector,
            { backgroundColor: colors.surface, borderColor: colors.border },
            pressed && { opacity: 0.7 },
          ]}
        >
          <Ionicons
            name="person-circle-outline"
            size={22}
            color={contactNumber ? colors.primary : colors.textMuted}
          />
          <Text
            style={[
              styles.selectorText,
              { color: contactNumber ? colors.text : colors.textMuted },
            ]}
          >
            {contactNumber ? `${contactName} · ${contactNumber}` : 'Elegir contacto'}
          </Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>

        {/* Fecha y hora */}
        <View style={styles.dateRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.label, { color: colors.text }]}>Fecha</Text>
            <Pressable
              onPress={() => setShowDate(true)}
              style={({ pressed }) => [
                styles.selector,
                { backgroundColor: colors.surface, borderColor: colors.border },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Ionicons name="calendar-outline" size={20} color={colors.textMuted} />
              <Text style={[styles.selectorText, { color: colors.text }]}>
                {formatDate(date.toISOString())}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Horas: una o varias por recordatorio */}
        <Text style={[styles.label, { color: colors.text }]}>Horas</Text>

        {/* Toggle: mismo mensaje en todas las horas */}
        <Pressable
          onPress={() => setSameMessage((v) => !v)}
          style={[
            styles.sameMsgRow,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.sameMsgText, { color: colors.text }]}>
            Mismo mensaje en todas las horas
          </Text>
          <View
            style={[
              styles.miniSwitch,
              { backgroundColor: sameMessage ? colors.primary : colors.border },
            ]}
          >
            <View
              style={[
                styles.miniThumb,
                { alignSelf: sameMessage ? 'flex-end' : 'flex-start' },
              ]}
            />
          </View>
        </Pressable>

        {times.map((t, i) => (
          <View key={i} style={{ marginBottom: 10 }}>
            <View style={styles.timeRow}>
              <Pressable
                onPress={() => setTimePickerIndex(i)}
                style={({ pressed }) => [
                  styles.selector,
                  { flex: 1, marginBottom: 0, backgroundColor: colors.surface, borderColor: colors.border },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Ionicons name="time-outline" size={20} color={colors.textMuted} />
                <Text style={[styles.selectorText, { color: colors.text }]}>
                  {formatTime(t.date.toISOString())}
                </Text>
              </Pressable>
              {times.length > 1 && (
                <Pressable
                  onPress={() => removeTime(i)}
                  hitSlop={8}
                  style={styles.variantRemove}
                  accessibilityRole="button"
                  accessibilityLabel="Quitar hora"
                >
                  <Ionicons name="close-circle" size={24} color={colors.danger} />
                </Pressable>
              )}
            </View>
            {!sameMessage && (
              <TextInput
                value={t.message}
                onChangeText={(text) =>
                  setTimes((prev) =>
                    prev.map((p, idx) => (idx === i ? { ...p, message: text } : p))
                  )
                }
                placeholder={`Mensaje para las ${formatTime(t.date.toISOString())}`}
                placeholderTextColor={colors.textMuted}
                multiline
                style={[
                  styles.variantInput,
                  {
                    marginTop: 8,
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
              />
            )}
          </View>
        ))}

        <Pressable
          onPress={addTime}
          style={({ pressed }) => [
            styles.variantAdd,
            { borderColor: colors.border, marginBottom: 18 },
            pressed && { opacity: 0.7 },
          ]}
        >
          <Ionicons name="add" size={18} color={colors.primary} />
          <Text style={[styles.variantAddText, { color: colors.primary }]}>
            Añadir hora
          </Text>
        </Pressable>

        {showDate && (
          <DateTimePicker
            value={date}
            mode="date"
            display="default"
            minimumDate={new Date()}
            onChange={onChangeDate}
          />
        )}
        {timePickerIndex != null && (
          <DateTimePicker
            value={times[timePickerIndex]?.date ?? new Date()}
            mode="time"
            display="default"
            onChange={onChangeTime}
          />
        )}

        {/* Repetición */}
        <Text style={[styles.label, { color: colors.text, marginTop: 6 }]}>
          Repetición
        </Text>
        <View style={styles.repeatRow}>
          {REPEAT_OPTIONS.map((opt) => {
            const active = repeatType === opt;
            return (
              <Pressable
                key={opt}
                onPress={() => setRepeatType(opt)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? colors.primary : colors.surface,
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: active ? '#FFFFFF' : colors.text },
                  ]}
                >
                  {REPEAT_LABELS[opt]}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Días de la semana: solo para 'custom' (personalizado). */}
        {repeatType === 'custom' && (
          <View style={{ marginBottom: 18 }}>
            <Text style={[styles.label, { color: colors.text }]}>Días</Text>
            <View style={styles.weekRow}>
              {WEEKDAY_LABELS.map((lbl, d) => {
                const active = weekDays.includes(d);
                return (
                  <Pressable
                    key={d}
                    onPress={() => toggleWeekDay(d)}
                    style={[
                      styles.dayChip,
                      {
                        backgroundColor: active ? colors.primary : colors.surface,
                        borderColor: active ? colors.primary : colors.border,
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Text
                      style={[
                        styles.dayChipText,
                        { color: active ? '#FFFFFF' : colors.text },
                      ]}
                    >
                      {lbl}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {/* Variantes de mensaje: solo para repetitivos (anti-baneo). */}
        {repeatType !== 'once' && (
          <View style={{ marginBottom: 18 }}>
            <Text style={[styles.label, { color: colors.text }]}>
              Variantes del mensaje (opcional)
            </Text>
            <Text style={[styles.variantHint, { color: colors.textMuted }]}>
              Al repetirse, se alterna entre el mensaje principal y estas
              variantes para que no se envíe siempre el mismo texto.
            </Text>
            {variants.map((v, i) => (
              <View key={i} style={styles.variantRow}>
                <TextInput
                  value={v}
                  onChangeText={(t) =>
                    setVariants((prev) =>
                      prev.map((p, idx) => (idx === i ? t : p))
                    )
                  }
                  placeholder={`Variante ${i + 1}`}
                  placeholderTextColor={colors.textMuted}
                  multiline
                  style={[
                    styles.variantInput,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      color: colors.text,
                    },
                  ]}
                />
                <Pressable
                  onPress={() =>
                    setVariants((prev) => prev.filter((_, idx) => idx !== i))
                  }
                  hitSlop={8}
                  style={styles.variantRemove}
                  accessibilityRole="button"
                  accessibilityLabel="Quitar variante"
                >
                  <Ionicons name="close-circle" size={22} color={colors.danger} />
                </Pressable>
              </View>
            ))}
            <Pressable
              onPress={() => setVariants((prev) => [...prev, ''])}
              style={({ pressed }) => [
                styles.variantAdd,
                { borderColor: colors.border },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Ionicons name="add" size={18} color={colors.primary} />
              <Text style={[styles.variantAddText, { color: colors.primary }]}>
                Añadir variante
              </Text>
            </Pressable>
          </View>
        )}

        {/* Activo */}
        <Pressable
          onPress={() => setEnabled((v) => !v)}
          style={[
            styles.activeRow,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.label, { color: colors.text, marginBottom: 0 }]}>
            Activo
          </Text>
          <View
            style={[
              styles.miniSwitch,
              { backgroundColor: enabled ? colors.primary : colors.border },
            ]}
          >
            <View
              style={[
                styles.miniThumb,
                { alignSelf: enabled ? 'flex-end' : 'flex-start' },
              ]}
            />
          </View>
        </Pressable>

        {/* Notificación local en este teléfono */}
        <Pressable
          onPress={() => setNotify((v) => !v)}
          style={[
            styles.notifyRow,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.notifyTextWrap}>
            <View style={styles.notifyTitleRow}>
              <Ionicons
                name="notifications-outline"
                size={18}
                color={notify ? colors.primary : colors.textMuted}
              />
              <Text style={[styles.label, { color: colors.text, marginBottom: 0 }]}>
                Notificarme en este teléfono
              </Text>
            </View>
            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              style={[styles.notifyPreview, { color: colors.textMuted }]}
            >
              {notify
                ? message.trim()
                  ? `Avisará: ${message.trim()}`
                  : 'Te avisará a la hora con el mensaje del recordatorio.'
                : 'Sin notificación local.'}
            </Text>
          </View>
          <View
            style={[
              styles.miniSwitch,
              { backgroundColor: notify ? colors.primary : colors.border },
            ]}
          >
            <View
              style={[
                styles.miniThumb,
                { alignSelf: notify ? 'flex-end' : 'flex-start' },
              ]}
            />
          </View>
        </Pressable>

        <Button
          title={editing ? 'Guardar cambios' : 'Crear recordatorio'}
          onPress={onSave}
          loading={saving}
          style={{ marginTop: 24 }}
        />
      </KeyboardAwareScrollView>

      <ContactPicker
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        onSelect={(name, number) => {
          setContactName(name);
          setContactNumber(number);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 14,
    minHeight: 52,
    marginBottom: 18,
  },
  selectorText: { fontSize: 16, flex: 1 },
  dateRow: { flexDirection: 'row', gap: 12 },
  repeatRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipText: { fontSize: 14, fontWeight: '600' },
  weekRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  dayChip: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayChipText: { fontSize: 15, fontWeight: '700' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sameMsgRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 14,
  },
  sameMsgText: { fontSize: 14, fontWeight: '600', flex: 1 },
  activeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  variantHint: { fontSize: 12, marginBottom: 12 },
  variantRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  variantInput: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    minHeight: 48,
    textAlignVertical: 'top',
  },
  variantRemove: { padding: 2 },
  variantAdd: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingVertical: 12,
    marginTop: 2,
  },
  variantAddText: { fontSize: 14, fontWeight: '600' },
  notifyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 14,
  },
  notifyTextWrap: { flex: 1, gap: 6 },
  notifyTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  notifyPreview: { fontSize: 13 },
  miniSwitch: {
    width: 50,
    height: 30,
    borderRadius: 15,
    padding: 3,
    justifyContent: 'center',
  },
  miniThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
});
