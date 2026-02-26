import { create } from 'zustand';
import { databaseApi, type QueryResult } from '../../../lib/tauri-ipc';

interface EditorState {
  sql: string;
  result: QueryResult | null;
  isRunning: boolean;
  error: string | null;
  setSql: (sql: string) => void;
  executeQuery: (wsId: string, connId: string) => Promise<void>;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  sql: '',
  result: null,
  isRunning: false,
  error: null,

  setSql: (sql) => {
    set({ sql });
  },

  executeQuery: async (wsId, connId) => {
    const { sql } = get();
    if (!sql.trim()) return;
    set({ isRunning: true, error: null });
    try {
      const result = await databaseApi.executeQuery(wsId, connId, sql);
      set({ result, isRunning: false });
    } catch (err) {
      set({ error: String(err), isRunning: false });
    }
  },
}));
