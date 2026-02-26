import { create } from 'zustand';
import { scratchpadApi } from '../../../lib/tauri-ipc';

interface ScratchpadStore {
  content: string;
  savedContent: string;
  loaded: boolean;
  saving: boolean;

  load: (workspaceId: string) => Promise<void>;
  save: (workspaceId: string) => Promise<void>;
  setContent: (content: string) => void;
  isDirty: () => boolean;
  reset: () => void;
}

export const useScratchpadStore = create<ScratchpadStore>((set, get) => ({
  content: '',
  savedContent: '',
  loaded: false,
  saving: false,

  load: async (workspaceId) => {
    try {
      const pad = await scratchpadApi.get(workspaceId);
      set({ content: pad.content, savedContent: pad.content, loaded: true });
    } catch {
      set({ content: '', savedContent: '', loaded: true });
    }
  },

  save: async (workspaceId) => {
    const { content } = get();
    set({ saving: true });
    try {
      await scratchpadApi.save(workspaceId, content);
      set({ savedContent: content });
    } catch {
      // Silent fail
    } finally {
      set({ saving: false });
    }
  },

  setContent: (content) => {
    set({ content });
  },

  isDirty: () => {
    const { content, savedContent } = get();
    return content !== savedContent;
  },

  reset: () => {
    set({ content: '', savedContent: '', loaded: false, saving: false });
  },
}));
