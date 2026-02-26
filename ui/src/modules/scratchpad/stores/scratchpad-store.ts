import { create } from 'zustand';
import { scratchpadApi } from '../../../lib/tauri-ipc';

interface ScratchpadStore {
  content: string;
  loaded: boolean;
  saving: boolean;

  load: (workspaceId: string) => Promise<void>;
  save: (workspaceId: string, content: string) => Promise<void>;
  setContent: (content: string) => void;
  reset: () => void;
}

export const useScratchpadStore = create<ScratchpadStore>((set) => ({
  content: '',
  loaded: false,
  saving: false,

  load: async (workspaceId) => {
    try {
      const pad = await scratchpadApi.get(workspaceId);
      set({ content: pad.content, loaded: true });
    } catch {
      set({ content: '', loaded: true });
    }
  },

  save: async (workspaceId, content) => {
    set({ saving: true });
    try {
      await scratchpadApi.save(workspaceId, content);
    } catch {
      // Silent fail — content is still in local state
    } finally {
      set({ saving: false });
    }
  },

  setContent: (content) => {
    set({ content });
  },

  reset: () => {
    set({ content: '', loaded: false, saving: false });
  },
}));
