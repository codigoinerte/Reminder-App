/**
 * Catálogo de países para el selector de prefijo telefónico.
 *
 * Enfocado en Latinoamérica + países comunes (EE.UU., España). Cada entrada
 * tiene el código ISO 3166-1 alpha-2 (para detectar el del dispositivo), el
 * nombre en español, el prefijo de marcación y la bandera como emoji.
 *
 * `dialCode` va SIN el "+" (solo dígitos), para concatenarlo directo al número
 * antes de enviarlo a Evolution/WhatsApp.
 */
export type Country = {
  /** ISO 3166-1 alpha-2, ej. "PE". */
  code: string;
  /** Nombre para mostrar. */
  name: string;
  /** Prefijo de marcación sin "+", ej. "51". */
  dialCode: string;
  /** Bandera como emoji. */
  flag: string;
};

export const COUNTRIES: Country[] = [
  { code: 'PE', name: 'Perú', dialCode: '51', flag: '🇵🇪' },
  { code: 'AR', name: 'Argentina', dialCode: '54', flag: '🇦🇷' },
  { code: 'BO', name: 'Bolivia', dialCode: '591', flag: '🇧🇴' },
  { code: 'BR', name: 'Brasil', dialCode: '55', flag: '🇧🇷' },
  { code: 'CL', name: 'Chile', dialCode: '56', flag: '🇨🇱' },
  { code: 'CO', name: 'Colombia', dialCode: '57', flag: '🇨🇴' },
  { code: 'CR', name: 'Costa Rica', dialCode: '506', flag: '🇨🇷' },
  { code: 'CU', name: 'Cuba', dialCode: '53', flag: '🇨🇺' },
  { code: 'DO', name: 'Rep. Dominicana', dialCode: '1', flag: '🇩🇴' },
  { code: 'EC', name: 'Ecuador', dialCode: '593', flag: '🇪🇨' },
  { code: 'SV', name: 'El Salvador', dialCode: '503', flag: '🇸🇻' },
  { code: 'ES', name: 'España', dialCode: '34', flag: '🇪🇸' },
  { code: 'US', name: 'Estados Unidos', dialCode: '1', flag: '🇺🇸' },
  { code: 'GT', name: 'Guatemala', dialCode: '502', flag: '🇬🇹' },
  { code: 'HN', name: 'Honduras', dialCode: '504', flag: '🇭🇳' },
  { code: 'MX', name: 'México', dialCode: '52', flag: '🇲🇽' },
  { code: 'NI', name: 'Nicaragua', dialCode: '505', flag: '🇳🇮' },
  { code: 'PA', name: 'Panamá', dialCode: '507', flag: '🇵🇦' },
  { code: 'PY', name: 'Paraguay', dialCode: '595', flag: '🇵🇾' },
  { code: 'PR', name: 'Puerto Rico', dialCode: '1', flag: '🇵🇷' },
  { code: 'UY', name: 'Uruguay', dialCode: '598', flag: '🇺🇾' },
  { code: 'VE', name: 'Venezuela', dialCode: '58', flag: '🇻🇪' },
];

/** País por defecto cuando no se detecta o no está en la lista. */
export const DEFAULT_COUNTRY: Country =
  COUNTRIES.find((c) => c.code === 'PE') ?? COUNTRIES[0];

/** Busca un país por su código ISO (case-insensitive). */
export function countryByCode(code: string | null | undefined): Country | undefined {
  if (!code) return undefined;
  const upper = code.toUpperCase();
  return COUNTRIES.find((c) => c.code === upper);
}

/**
 * Dado un número que YA viene con código de país (formato internacional, solo
 * dígitos), intenta separar el prefijo del país y el resto. Devuelve el país
 * detectado y el número local. Si no matchea ningún prefijo conocido, devuelve
 * país undefined y el número tal cual.
 *
 * Probamos los prefijos más largos primero (ej. 591 antes que 5) para no
 * confundir Bolivia con un número que empiece en 5.
 */
export function splitDialCode(
  digits: string
): { country?: Country; local: string } {
  const candidates = [...COUNTRIES].sort(
    (a, b) => b.dialCode.length - a.dialCode.length
  );
  for (const c of candidates) {
    if (digits.startsWith(c.dialCode)) {
      return { country: c, local: digits.slice(c.dialCode.length) };
    }
  }
  return { local: digits };
}
