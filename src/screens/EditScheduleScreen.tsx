import React, { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
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
import { formatDate, formatTime } from '../utils/format';
import type { RootStackParamList } from '../navigation/types';

const REPEAT_OPTIONS: RepeatType[] = ['once', 'daily', 'weekly', 'monthly'];

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
  const [enabled, setEnabled] = useState(editing?.enabled ?? true);
  // Notificación LOCAL en este teléfono (no se sincroniza ni la dispara el
  // backend). Al editar, refleja si ya hay una programada en este dispositivo.
  const [notify, setNotify] = useState(!editing);

  const [showDate, setShowDate] = useState(false);
  const [showTime, setShowTime] = useState(false);
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
    setShowTime(Platform.OS === 'ios');
    if (selected) {
      const next = new Date(date);
      next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
      setDate(next);
    }
  };

  const validate = (): string | null => {
    if (!title.trim()) return 'El título es obligatorio.';
    if (!message.trim()) return 'El mensaje es obligatorio.';
    if (!contactNumber) return 'Debes elegir un destinatario.';
    if (repeatType === 'once' && date.getTime() < Date.now())
      return 'La fecha/hora ya pasó. Elige una futura.';
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
          message: saved.message,
          date: new Date(saved.scheduleDate),
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
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
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

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}
        keyboardShouldPersistTaps="handled"
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

        <Text style={[styles.label, { color: colors.text }]}>Hora</Text>
        <Pressable
          onPress={() => setShowTime(true)}
          style={({ pressed }) => [
            styles.selector,
            { backgroundColor: colors.surface, borderColor: colors.border },
            pressed && { opacity: 0.7 },
          ]}
        >
          <Ionicons name="time-outline" size={20} color={colors.textMuted} />
          <Text style={[styles.selectorText, { color: colors.text }]}>
            {formatTime(date.toISOString())}
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
        {showTime && (
          <DateTimePicker
            value={date}
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
      </ScrollView>

      <ContactPicker
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        onSelect={(name, number) => {
          setContactName(name);
          setContactNumber(number);
        }}
      />
    </KeyboardAvoidingView>
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
  activeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
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
