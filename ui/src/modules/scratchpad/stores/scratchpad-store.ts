import { create } from 'zustand';
import { scratchpadApi, type ScratchpadData } from '../../../lib/tauri-ipc';
import { useTabStore } from '../../../stores/tab-store';

interface PadState {
  content: string;
  savedContent: string;
  saving: boolean;
  loaded: boolean;
}

interface ScratchpadStore {
  pads: ScratchpadData[];
  loadedForWorkspace: string | null;
  padStates: Record<string, PadState>;

  loadPads: (workspaceId: string) => Promise<void>;
  createPad: (workspaceId: string, name: string) => Promise<ScratchpadData>;
  deletePad: (workspaceId: string, id: string) => Promise<void>;
  renamePad: (workspaceId: string, id: string, name: string) => Promise<void>;

  loadPadContent: (workspaceId: string, id: string) => Promise<void>;
  savePad: (workspaceId: string, id: string) => Promise<void>;
  setPadContent: (id: string, content: string) => void;
  isPadDirty: (id: string) => boolean;
}

export const useScratchpadStore = create<ScratchpadStore>((set, get) => ({
  pads: [],
  loadedForWorkspace: null,
  padStates: {},

  loadPads: async (workspaceId) => {
    try {
      const pads = await scratchpadApi.list(workspaceId);
      set({ pads: Array.isArray(pads) ? pads : [], loadedForWorkspace: workspaceId });
    } catch {
      set({ pads: [], loadedForWorkspace: workspaceId });
    }
  },

  createPad: async (workspaceId, name) => {
    const pad = await scratchpadApi.create(workspaceId, name);
    set((s) => ({ pads: [pad, ...s.pads] }));
    return pad;
  },

  deletePad: async (workspaceId, id) => {
    await scratchpadApi.delete(workspaceId, id);
    useTabStore.getState().removeTab(`scratchpad-${id}`);
    set((s) => {
      const { [id]: _, ...rest } = s.padStates;
      return {
        pads: s.pads.filter((p) => p.id !== id),
        padStates: rest,
      };
    });
  },

  renamePad: async (workspaceId, id, name) => {
    const updated = await scratchpadApi.rename(workspaceId, id, name);
    set((s) => ({
      pads: s.pads.map((p) => (p.id === id ? updated : p)),
    }));
  },

  loadPadContent: async (workspaceId, id) => {
    const existing = get().padStates[id];
    if (existing?.loaded) return;

    set((s) => ({
      padStates: {
        ...s.padStates,
        [id]: { content: '', savedContent: '', saving: false, loaded: false },
      },
    }));

    try {
      const pad = await scratchpadApi.get(workspaceId, id);
      set((s) => ({
        padStates: {
          ...s.padStates,
          [id]: { content: pad.content, savedContent: pad.content, saving: false, loaded: true },
        },
      }));
    } catch {
      set((s) => ({
        padStates: {
          ...s.padStates,
          [id]: { content: '', savedContent: '', saving: false, loaded: true },
        },
      }));
    }
  },

  savePad: async (workspaceId, id) => {
    const state = get().padStates[id];
    if (!state) return;
    set((s) => ({
      padStates: { ...s.padStates, [id]: { ...s.padStates[id], saving: true } },
    }));
    try {
      await scratchpadApi.save(workspaceId, id, state.content);
      set((s) => ({
        padStates: {
          ...s.padStates,
          [id]: { ...s.padStates[id], savedContent: state.content, saving: false },
        },
      }));
    } catch {
      set((s) => ({
        padStates: { ...s.padStates, [id]: { ...s.padStates[id], saving: false } },
      }));
    }
  },

  setPadContent: (id, content) => {
    set((s) => ({
      padStates: {
        ...s.padStates,
        [id]: { ...s.padStates[id], content },
      },
    }));
  },

  isPadDirty: (id) => {
    const state = get().padStates[id];
    if (!state) return false;
    return state.content !== state.savedContent;
  },
}));
