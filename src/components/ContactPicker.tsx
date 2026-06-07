import React, { useEffect, useState } from 'react';
import {
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
import { Contact as PhoneContact, ContactField } from 'expo-contacts';
import * as Localization from 'expo-localization';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import type { Contact } from '../types';
import { listContacts, saveContact } from '../data/contactsDb';
import { normalizeNumber } from '../utils/format';
import {
  COUNTRIES,
  DEFAULT_COUNTRY,
  countryByCode,
  splitDialCode,
  type Country,
} from '../data/countries';
import { Button } from './Button';
import { CountryPicker } from './CountryPicker';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelect: (name: string, number: string) => void;
};

/** Detecta el país del dispositivo; cae a Perú si no se reconoce. */
function detectCountry(): Country {
  try {
    const region = Localization.getLocales()[0]?.regionCode; // ej. "PE"
    return countryByCode(region) ?? DEFAULT_COUNTRY;
  } catch {
    return DEFAULT_COUNTRY;
  }
}

export function ContactPicker({ visible, onClose, onSelect }: Props) {
  const { colors } = useTheme();
  const [saved, setSaved] = useState<Contact[]>([]);
  const [manualName, setManualName] = useState('');
  const [manualNumber, setManualNumber] = useState('');
  const [country, setCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [countryPickerVisible, setCountryPickerVisible] = useState(false);

  useEffect(() => {
    if (visible) {
      listContacts().then(setSaved).catch(() => {});
      setManualName('');
      setManualNumber('');
      setCountry(detectCountry());
    }
  }, [visible]);

  // SDK 56: usa el selector NATIVO de contactos. presentPicker() pide permiso
  // internamente y abre la UI del sistema; devuelve un Contact (o null).
  const pickFromPhone = async () => {
    try {
      const picked = await PhoneContact.presentPicker();
      if (!picked) return; // el usuario canceló
      const details = await picked.getDetails([
        ContactField.FULL_NAME,
        ContactField.GIVEN_NAME,
        ContactField.PHONES,
      ]);
      const phone = details.phones?.[0]?.number ?? '';
      const name = details.fullName ?? details.givenName ?? 'Contacto';
      if (!phone) {
        Alert.alert(
          'Sin número',
          'El contacto elegido no tiene un número de teléfono.'
        );
        return;
      }
      // Los contactos del teléfono suelen venir con "+país". Resolvemos su
      // número internacional respetando ese prefijo si lo trae.
      choose(name, resolvePhoneNumber(phone));
    } catch {
      Alert.alert(
        'No se pudo acceder',
        'No se pudieron leer los contactos. Puedes ingresar el número manualmente.'
      );
    }
  };

  /**
   * Para un número que VIENE de la agenda o de un contacto guardado: si trae
   * "+" (internacional) usamos sus dígitos tal cual; si no, le anteponemos el
   * prefijo del país seleccionado.
   */
  const resolvePhoneNumber = (raw: string): string => {
    const hadPlus = raw.trim().startsWith('+');
    const digits = normalizeNumber(raw);
    if (hadPlus) return digits; // ya es internacional
    return `${country.dialCode}${digits}`;
  };

  // Confirma un contacto ya en formato internacional (dígitos con código país).
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

  // Ingreso manual: el número del input es LOCAL; le anteponemos el prefijo del
  // país elegido en el selector.
  const chooseManual = () => {
    const local = normalizeNumber(manualNumber);
    if (!manualName.trim() || local.length < 6) {
      Alert.alert('Datos incompletos', 'Revisa el nombre y el número.');
      return;
    }
    choose(manualName, `${country.dialCode}${local}`);
  };

  return (
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
            <Text style={[styles.title, { color: colors.text }]}>
              Elegir destinatario
            </Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </Pressable>
          </View>

          <Pressable
            onPress={pickFromPhone}
            style={({ pressed }) => [
              styles.phoneBtn,
              { backgroundColor: colors.surface, borderColor: colors.border },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Ionicons name="people-outline" size={20} color={colors.primary} />
            <Text style={[styles.phoneBtnText, { color: colors.text }]}>
              Elegir de mis contactos
            </Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>

          {saved.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
                Recientes
              </Text>
              <FlatList
                style={styles.savedList}
                data={saved}
                keyExtractor={(c) => c.id}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <Pressable
                    onPress={() => choose(item.name, item.number)}
                    style={({ pressed }) => [
                      styles.savedRow,
                      { borderBottomColor: colors.border },
                      pressed && { opacity: 0.6 },
                    ]}
                  >
                    <Ionicons
                      name="person-circle-outline"
                      size={28}
                      color={colors.textMuted}
                    />
                    <View style={{ marginLeft: 10 }}>
                      <Text style={[styles.savedName, { color: colors.text }]}>
                        {item.name}
                      </Text>
                      <Text style={[styles.savedNum, { color: colors.textMuted }]}>
                        {formatSavedNumber(item.number)}
                      </Text>
                    </View>
                  </Pressable>
                )}
              />
            </>
          )}

          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
            O ingresar manualmente
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

          {/* Fila: selector de país (bandera + prefijo) + número local */}
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
              <Text style={[styles.countryDial, { color: colors.text }]}>
                +{country.dialCode}
              </Text>
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
            style={{ marginTop: 6 }}
          />
        </View>
      </View>

      <CountryPicker
        visible={countryPickerVisible}
        onClose={() => setCountryPickerVisible(false)}
        onSelect={setCountry}
        selectedCode={country.code}
      />
    </Modal>
  );
}

/** Muestra un número guardado como "+51 930299310" si reconocemos el prefijo. */
function formatSavedNumber(number: string): string {
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
    marginBottom: 16,
  },
  title: { fontSize: 20, fontWeight: '700' },
  phoneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 16,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 12,
  },
  phoneBtnText: { fontSize: 16, fontWeight: '600', flex: 1 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 8,
    marginBottom: 8,
  },
  savedList: { maxHeight: 180 },
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
