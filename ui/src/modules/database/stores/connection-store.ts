import { create } from 'zustand';
import { connectionApi, type Connection, type CreateConnectionInput } from '../../../lib/tauri-ipc';

interface ConnectionState {
  connections: Connection[];
  activeConnection: Connection | null;
  loading: boolean;
  error: string | null;
  fetchConnections: (wsId: string) => Promise<void>;
  createConnection: (wsId: string, data: CreateConnectionInput) => Promise<Connection>;
  deleteConnection: (wsId: string, id: string) => Promise<void>;
  testConnection: (wsId: string, id: string) => Promise<{ success: boolean; message: string }>;
  selectConnection: (connection: Connection) => void;
}

export const useConnectionStore = create<ConnectionState>((set, get) => ({
  connections: [],
  activeConnection: null,
  loading: false,
  error: null,

  fetchConnections: async (wsId) => {
    set({ loading: true, error: null });
    try {
      const connections = await connectionApi.list(wsId);
      set({ connections, loading: false });
    } catch (err) {
      set({ error: String(err), loading: false });
    }
  },

  createConnection: async (wsId, data) => {
    const connection = await connectionApi.create(wsId, data);
    set((state) => ({ connections: [...state.connections, connection] }));
    return connection;
  },

  deleteConnection: async (wsId, id) => {
    await connectionApi.delete(wsId, id);
    const state = get();
    set({
      connections: state.connections.filter((c) => c.id !== id),
      activeConnection: state.activeConnection?.id === id ? null : state.activeConnection,
    });
  },

  testConnection: async (wsId, id) => {
    return connectionApi.test(wsId, id);
  },

  selectConnection: (connection) => {
    set({ activeConnection: connection });
  },
}));
