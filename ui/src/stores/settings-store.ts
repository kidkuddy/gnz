import { create } from 'zustand';
import { configApi, type AppConfig } from '../lib/tauri-ipc';

interface SettingsState {
  config: AppConfig | null;
  loading: boolean;
  error: string | null;
  fetchConfig: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  config: null,
  loading: false,
  error: null,

  fetchConfig: async () => {
    set({ loading: true, error: null });
    try {
      const config = await configApi.get();
      set({ config, loading: false });
    } catch (err) {
      set({ error: String(err), loading: false });
    }
  },
}));
