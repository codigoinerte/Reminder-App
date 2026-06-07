import type { Schedule } from '../types';

/** Stack raíz: gate de auth, tabs y la pantalla modal de crear/editar. */
export type RootStackParamList = {
  Auth: undefined;
  Tabs: undefined;
  EditSchedule: { schedule?: Schedule } | undefined;
};

export type TabsParamList = {
  Schedule: undefined;
  Settings: undefined;
};
