import { create } from 'zustand';
import { filesApi, type FileEntry, type FileContent, type TreeEntry } from '../../../lib/tauri-ipc';

interface SearchState {
  query: string;
  results: FileEntry[];
  loading: boolean;
  error: string | null;
  activeFile: FileContent | null;
  fileLoading: boolean;
  tree: TreeEntry[];
  treeLoading: boolean;
  expandedDirs: Set<string>;
  lastWorkspaceId: string | null;
  setQuery: (query: string) => void;
  search: (ws: string, query: string) => Promise<void>;
  readFile: (ws: string, path: string) => Promise<void>;
  fetchTree: (ws: string) => Promise<void>;
  toggleDir: (path: string) => void;
  createFile: (ws: string, path: string) => Promise<void>;
  moveFile: (ws: string, from: string, to: string) => Promise<void>;
  renameFile: (ws: string, path: string, newName: string) => Promise<void>;
  deleteFile: (ws: string, path: string) => Promise<void>;
  clear: () => void;
}

export const useSearchStore = create<SearchState>((set, get) => ({
  query: '',
  results: [],
  loading: false,
  error: null,
  activeFile: null,
  fileLoading: false,
  tree: [],
  treeLoading: false,
  expandedDirs: new Set<string>(),
  lastWorkspaceId: null,

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

  fetchTree: async (ws) => {
    set({ treeLoading: true, lastWorkspaceId: ws });
    try {
      const tree = await filesApi.tree(ws);
      set({ tree, treeLoading: false });
    } catch (err) {
      set({ tree: [], treeLoading: false });
    }
  },

  toggleDir: (path) => {
    const expanded = new Set(get().expandedDirs);
    if (expanded.has(path)) {
      expanded.delete(path);
    } else {
      expanded.add(path);
    }
    set({ expandedDirs: expanded });
  },

  createFile: async (ws, path) => {
    await filesApi.create(ws, path);
    await get().fetchTree(ws);
  },

  moveFile: async (ws, from, to) => {
    await filesApi.move(ws, from, to);
    await get().fetchTree(ws);
  },

  renameFile: async (ws, path, newName) => {
    await filesApi.rename(ws, path, newName);
    await get().fetchTree(ws);
  },

  deleteFile: async (ws, path) => {
    await filesApi.delete(ws, path);
    await get().fetchTree(ws);
  },

  clear: () => set({ query: '', results: [], activeFile: null, error: null }),
}));
