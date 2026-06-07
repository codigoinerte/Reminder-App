/**
 * Paleta de colores. Light y Dark según el documento del proyecto.
 */
export type ThemeColors = {
  background: string;
  surface: string; // tarjetas
  surfaceAlt: string;
  primary: string;
  text: string;
  textMuted: string;
  border: string;
  danger: string;
  success: string;
  warning: string;
  fabText: string;
};

export const lightColors: ThemeColors = {
  background: '#F6F7FB',
  surface: '#FFFFFF',
  surfaceAlt: '#EEF1F8',
  primary: '#5B9DFF',
  text: '#1A1D23',
  textMuted: '#6B7280',
  border: '#E4E7EE',
  danger: '#EF4444',
  success: '#22C55E',
  warning: '#F59E0B',
  fabText: '#FFFFFF',
};

export const darkColors: ThemeColors = {
  background: '#121212',
  surface: '#1E1E1E',
  surfaceAlt: '#262626',
  primary: '#5B9DFF',
  text: '#F3F4F6',
  textMuted: '#9CA3AF',
  border: '#2C2C2C',
  danger: '#F87171',
  success: '#4ADE80',
  warning: '#FBBF24',
  fabText: '#FFFFFF',
};
