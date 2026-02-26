import { create } from 'zustand';
import { terminalApi, type TerminalSession } from '../../../lib/tauri-ipc';

interface TerminalStore {
  sessions: TerminalSession[];
  activeSessionId: string | null;

  loadSessions: (workspaceId: string) => Promise<void>;
  createSession: (workspaceId: string, cwd?: string) => Promise<TerminalSession>;
  deleteSession: (workspaceId: string, id: string) => Promise<void>;
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
    set((s) => ({
      sessions: s.sessions.filter((sess) => sess.id !== id),
      activeSessionId: s.activeSessionId === id ? null : s.activeSessionId,
    }));
  },

  setActiveSession: (id) => {
    set({ activeSessionId: id });
  },
}));
