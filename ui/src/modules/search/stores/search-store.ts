import { create } from 'zustand';
import { filesApi, type FileEntry, type FileContent } from '../../../lib/tauri-ipc';

interface SearchState {
  query: string;
  results: FileEntry[];
  loading: boolean;
  error: string | null;
  activeFile: FileContent | null;
  fileLoading: boolean;
  setQuery: (query: string) => void;
  search: (ws: string, query: string) => Promise<void>;
  readFile: (ws: string, path: string) => Promise<void>;
  clear: () => void;
}

export const useSearchStore = create<SearchState>((set) => ({
  query: '',
  results: [],
  loading: false,
  error: null,
  activeFile: null,
  fileLoading: false,

  setQuery: (query) => set({ query }),

  search: async (ws, query) => {
    if (!query.trim()) {
      set({ results: [], loading: false, error: null });
      return;
    }
    set({ loading: true, error: null });
    try {
      const results = await filesApi.search(ws, query);
      set({ results, loading: false });
    } catch (err) {
      set({ error: String(err), loading: false, results: [] });
    }
  },

  readFile: async (ws, path) => {
    set({ fileLoading: true });
    try {
      const file = await filesApi.read(ws, path);
      set({ activeFile: file, fileLoading: false });
    } catch (err) {
      set({ activeFile: null, fileLoading: false });
    }
  },

  clear: () => set({ query: '', results: [], activeFile: null, error: null }),
}));
