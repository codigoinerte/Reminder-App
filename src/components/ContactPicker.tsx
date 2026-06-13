import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import * as Localization from 'expo-localization';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import type { Contact } from '../types';
import { listContacts, saveContact } from '../data/contactsDb';
import { normalizeNumber } from '../utils/format';
import {
  DEFAULT_COUNTRY,
  countryByCode,
  splitDialCode,
  type Country,
} from '../data/countries';
import { getWhatsAppContacts } from '../api/client';
import { matchAgendaWithWhatsApp, type MatchedContact } from '../data/phoneContacts';
import { Button } from './Button';
import { CountryPicker } from './CountryPicker';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelect: (name: string, number: string) => void;
};

function detectCountry(): Country {
  try {
    const region = Localization.getLocales()[0]?.regionCode;
    return countryByCode(region) ?? DEFAULT_COUNTRY;
  } catch {
    return DEFAULT_COUNTRY;
  }
}

export function ContactPicker({ visible, onClose, onSelect }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [saved, setSaved] = useState<Contact[]>([]);
  const [manualName, setManualName] = useState('');
  const [manualNumber, setManualNumber] = useState('');
  const [country, setCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [countryPickerVisible, setCountryPickerVisible] = useState(false);
  const [waContacts, setWaContacts] = useState<MatchedContact[]>([]);
  const [waLoading, setWaLoading] = useState(false);
  const [waError, setWaError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<'wa' | 'manual'>('wa');

  useEffect(() => {
    if (!visible) return;
    listContacts().then(setSaved).catch(() => {});
    setManualName('');
    setManualNumber('');
    setQuery('');
    setTab('wa');
    setCountry(detectCountry());
    loadWhatsAppContacts();
  }, [visible]);

  const loadWhatsAppContacts = async () => {
    setWaLoading(true);
    setWaError(null);
    try {
      const wa = await getWhatsAppContacts();
      if (wa.length === 0) {
        setWaContacts([]);
        setWaError(
          'No hay contactos de WhatsApp sincronizados. Reconecta WhatsApp o usa el ingreso manual.'
        );
        return;
      }
      const { status, contacts } = await matchAgendaWithWhatsApp(wa);
      if (status === 'denied') {
        setWaContacts([]);
        setWaError(
          'Sin permiso de contactos. Actívalo para ver tu agenda, o usa el ingreso manual.'
        );
        return;
      }
      setWaContacts(contacts);
      if (contacts.length === 0) {
        setWaError(
          'Ninguno de tus contactos agendados tiene WhatsApp (o tu agenda está vacía). Usa el ingreso manual.'
        );
      }
    } catch {
      setWaError('No se pudieron cargar los contactos.');
    } finally {
      setWaLoading(false);
    }
  };

  const waFiltered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return waContacts;
    return waContacts.filter(
      (c) => c.name.toLowerCase().includes(q) || c.number.includes(q)
    );
  }, [query, waContacts]);

  const choose = async (name: string, internationalNumber: string) => {
    const number = normalizeNumber(internationalNumber);
    if (!name.trim() || number.length < 8) {
      Alert.alert('Datos incompletos', 'Revisa el nombre y el número.');
      return;
    }
    await saveContact(name.trim(), number).catch(() => {});
    onSelect(name.trim(), number);
    onClose();
  };

  const chooseManual = () => {
    const local = normalizeNumber(manualNumber);
    if (!manualName.trim() || local.length < 6) {
      Alert.alert('Datos incompletos', 'Revisa el nombre y el número.');
      return;
    }
    choose(manualName, `${country.dialCode}${local}`);
  };

  // Modal fullscreen para ingreso manual — KeyboardAwareScrollView funciona
  // correctamente en pantalla completa en ambas plataformas.
  const manualModal = (
    <Modal
      visible={visible && tab === 'manual'}
      animationType="slide"
      onRequestClose={() => setTab('wa')}
    >
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View
          style={[
            styles.fullHeader,
            {
              paddingTop: insets.top + 12,
              borderBottomColor: colors.border,
              backgroundColor: colors.background,
            },
          ]}
        >
          <Pressable onPress={() => setTab('wa')} hitSlop={10}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={[styles.fullTitle, { color: colors.text }]}>Ingreso manual</Text>
          <View style={{ width: 24 }} />
        </View>

        <KeyboardAwareScrollView
          contentContainerStyle={{
            padding: 20,
            paddingBottom: insets.bottom + 24,
          }}
          keyboardShouldPersistTaps="handled"
          enableOnAndroid
          extraScrollHeight={20}
        >
          {saved.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
                Recientes
              </Text>
              {saved.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => choose(item.name, item.number)}
                  style={({ pressed }) => [
                    styles.savedRow,
                    { borderBottomColor: colors.border },
                    pressed && { opacity: 0.6 },
                  ]}
                >
                  <Ionicons name="person-circle-outline" size={28} color={colors.textMuted} />
                  <View style={{ marginLeft: 10 }}>
                    <Text style={[styles.savedName, { color: colors.text }]}>{item.name}</Text>
                    <Text style={[styles.savedNum, { color: colors.textMuted }]}>
                      {formatNumber(item.number)}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </>
          )}

          <Text style={[styles.sectionLabel, { color: colors.textMuted, marginTop: saved.length > 0 ? 16 : 0 }]}>
            Nuevo contacto
          </Text>
          <TextInput
            value={manualName}
            onChangeText={setManualName}
            placeholder="Nombre"
            placeholderTextColor={colors.textMuted}
            style={[
              styles.input,
              { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text },
            ]}
          />

          <View style={styles.phoneRow}>
            <Pressable
              onPress={() => setCountryPickerVisible(true)}
              style={({ pressed }) => [
                styles.countryBtn,
                { backgroundColor: colors.surface, borderColor: colors.border },
                pressed && { opacity: 0.7 },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`País: ${country.name}, prefijo +${country.dialCode}`}
            >
              <Text style={styles.countryFlag}>{country.flag}</Text>
              <Text style={[styles.countryDial, { color: colors.text }]}>+{country.dialCode}</Text>
              <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
            </Pressable>

            <TextInput
              value={manualNumber}
              onChangeText={setManualNumber}
              placeholder="Número"
              placeholderTextColor={colors.textMuted}
              keyboardType="phone-pad"
              style={[
                styles.input,
                styles.numberInput,
                { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text },
              ]}
            />
          </View>

          <Button
            title="Usar este contacto"
            onPress={chooseManual}
            style={{ marginTop: 8 }}
          />
        </KeyboardAwareScrollView>
      </View>

      <CountryPicker
        visible={countryPickerVisible}
        onClose={() => setCountryPickerVisible(false)}
        onSelect={setCountry}
        selectedCode={country.code}
      />
    </Modal>
  );

  return (
    <>
      {/* Bottom sheet con tab WhatsApp */}
      <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
        <View style={styles.backdrop}>
          <View
            style={[
              styles.sheet,
              { backgroundColor: colors.background, borderColor: colors.border },
            ]}
          >
            <View style={styles.handleWrap}>
              <View style={[styles.handle, { backgroundColor: colors.border }]} />
            </View>

            <View style={styles.headerRow}>
              <Text style={[styles.title, { color: colors.text }]}>Elegir destinatario</Text>
              <Pressable onPress={onClose} hitSlop={10}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </Pressable>
            </View>

            {/* Toggle WhatsApp / Manual */}
            <View style={[styles.tabs, { backgroundColor: colors.surfaceAlt }]}>
              {(['wa', 'manual'] as const).map((t) => {
                const active = tab === t;
                return (
                  <Pressable
                    key={t}
                    onPress={() => setTab(t)}
                    style={[styles.tab, active && { backgroundColor: colors.surface }]}
                  >
                    <Ionicons
                      name={t === 'wa' ? 'logo-whatsapp' : 'create-outline'}
                      size={16}
                      color={active ? colors.primary : colors.textMuted}
                    />
                    <Text style={[styles.tabText, { color: active ? colors.text : colors.textMuted }]}>
                      {t === 'wa' ? 'WhatsApp' : 'Manual'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Solo muestra WhatsApp aquí; Manual abre su propio Modal fullscreen */}
            <View style={styles.waWrap}>
              <View
                style={[
                  styles.search,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <Ionicons name="search" size={18} color={colors.textMuted} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Buscar por nombre o número"
                  placeholderTextColor={colors.textMuted}
                  style={[styles.searchInput, { color: colors.text }]}
                  autoCorrect={false}
                />
                {query.length > 0 && (
                  <Pressable onPress={() => setQuery('')} hitSlop={8}>
                    <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                  </Pressable>
                )}
              </View>

              {waLoading ? (
                <View style={styles.center}>
                  <ActivityIndicator color={colors.primary} />
                  <Text style={[styles.muted, { color: colors.textMuted }]}>Cargando contactos…</Text>
                </View>
              ) : waError ? (
                <View style={styles.center}>
                  <Ionicons name="cloud-offline-outline" size={32} color={colors.textMuted} />
                  <Text style={[styles.muted, { color: colors.textMuted }]}>{waError}</Text>
                  <Pressable onPress={loadWhatsAppContacts} style={styles.retry}>
                    <Ionicons name="refresh" size={16} color={colors.primary} />
                    <Text style={[styles.retryText, { color: colors.primary }]}>Reintentar</Text>
                  </Pressable>
                </View>
              ) : (
                <FlatList
                  data={waFiltered}
                  keyExtractor={(c) => c.number}
                  keyboardShouldPersistTaps="handled"
                  style={styles.waList}
                  initialNumToRender={15}
                  ListEmptyComponent={
                    <Text style={[styles.muted, { color: colors.textMuted }]}>
                      Sin resultados para "{query}".
                    </Text>
                  }
                  renderItem={({ item }) => (
                    <Pressable
                      onPress={() => choose(item.name, item.number)}
                      style={({ pressed }) => [
                        styles.waRow,
                        { borderBottomColor: colors.border },
                        pressed && { opacity: 0.6 },
                      ]}
                    >
                      <Ionicons name="person-circle-outline" size={30} color={colors.textMuted} />
                      <View style={{ marginLeft: 10, flex: 1 }}>
                        <Text style={[styles.waName, { color: colors.text }]} numberOfLines={1}>
                          {item.name}
                        </Text>
                        <Text style={[styles.waNum, { color: colors.textMuted }]}>
                          {formatNumber(item.number)}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                    </Pressable>
                  )}
                />
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal fullscreen para ingreso manual — teclado funciona correctamente */}
      {manualModal}
    </>
  );
}

function formatNumber(number: string): string {
  const { country, local } = splitDialCode(normalizeNumber(number));
  return country ? `+${country.dialCode} ${local}` : number;
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    maxHeight: '88%',
    borderWidth: StyleSheet.hairlineWidth,
  },
  handleWrap: { alignItems: 'center', paddingVertical: 10 },
  handle: { width: 40, height: 5, borderRadius: 3 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  title: { fontSize: 20, fontWeight: '700' },
  tabs: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
    marginBottom: 14,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 9,
  },
  tabText: { fontSize: 14, fontWeight: '600' },
  waWrap: { minHeight: 300 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    height: 48,
    marginBottom: 10,
  },
  searchInput: { flex: 1, fontSize: 16 },
  waList: { maxHeight: 420 },
  waRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  waName: { fontSize: 15, fontWeight: '600' },
  waNum: { fontSize: 13, marginTop: 1 },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40, gap: 10 },
  muted: { fontSize: 14, textAlign: 'center', paddingHorizontal: 20 },
  retry: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  retryText: { fontSize: 15, fontWeight: '600' },
  // fullscreen manual
  fullHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  fullTitle: { fontSize: 17, fontWeight: '700' },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  savedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  savedName: { fontSize: 15, fontWeight: '600' },
  savedNum: { fontSize: 13 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 10,
  },
  phoneRow: { flexDirection: 'row', gap: 8 },
  countryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    height: 52,
    marginBottom: 10,
  },
  countryFlag: { fontSize: 20 },
  countryDial: { fontSize: 16, fontWeight: '600' },
  numberInput: { flex: 1 },
});
