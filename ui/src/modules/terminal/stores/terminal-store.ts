import { create } from 'zustand';
import { terminalApi, type TerminalSession } from '../../../lib/tauri-ipc';
import { useTabStore } from '../../../stores/tab-store';

interface TerminalStore {
  sessions: TerminalSession[];
  activeSessionId: string | null;

  loadSessions: (workspaceId: string) => Promise<void>;
  createSession: (workspaceId: string, cwd?: string) => Promise<TerminalSession>;
  deleteSession: (workspaceId: string, id: string) => Promise<void>;
  renameSession: (workspaceId: string, id: string, name: string) => Promise<void>;
  setActiveSession: (id: string | null) => void;
}

export const useTerminalStore = create<TerminalStore>((set) => ({
  sessions: [],
  activeSessionId: null,

  loadSessions: async (workspaceId) => {
    try {
      const sessions = await terminalApi.list(workspaceId);
      set({ sessions: Array.isArray(sessions) ? sessions : [] });
    } catch {
      set({ sessions: [] });
    }
  },

  createSession: async (workspaceId, cwd) => {
    const sess = await terminalApi.create(workspaceId, { cwd });
    set((s) => ({ sessions: [sess, ...s.sessions] }));
    return sess;
  },

  deleteSession: async (workspaceId, id) => {
    await terminalApi.delete(workspaceId, id);
    useTabStore.getState().removeTab(`terminal-${id}`);
    set((s) => ({
      sessions: s.sessions.filter((sess) => sess.id !== id),
      activeSessionId: s.activeSessionId === id ? null : s.activeSessionId,
    }));
  },

  renameSession: async (workspaceId, id, name) => {
    await terminalApi.rename(workspaceId, id, name);
    set((s) => ({
      sessions: s.sessions.map((sess) => (sess.id === id ? { ...sess, name } : sess)),
    }));
  },

  setActiveSession: (id) => {
    set({ activeSessionId: id });
  },
}));
