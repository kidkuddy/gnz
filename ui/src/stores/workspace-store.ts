import { create } from 'zustand';
import { workspaceApi, type Workspace, type CreateWorkspaceInput } from '../lib/tauri-ipc';

interface WorkspaceState {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  loading: boolean;
  error: string | null;
  fetchWorkspaces: () => Promise<void>;
  createWorkspace: (data: CreateWorkspaceInput) => Promise<Workspace>;
  selectWorkspace: (workspace: Workspace) => void;
  deleteWorkspace: (id: string) => Promise<void>;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  workspaces: [],
  activeWorkspace: null,
  loading: false,
  error: null,

  fetchWorkspaces: async () => {
    set({ loading: true, error: null });
    try {
      const workspaces = await workspaceApi.list();
      set({ workspaces, loading: false });
    } catch (err) {
      set({ error: String(err), loading: false });
    }
  },

  createWorkspace: async (data) => {
    const workspace = await workspaceApi.create(data);
    set((state) => ({ workspaces: [...state.workspaces, workspace] }));
    return workspace;
  },

  selectWorkspace: (workspace) => {
    set({ activeWorkspace: workspace });
  },

  deleteWorkspace: async (id) => {
    await workspaceApi.delete(id);
    const state = get();
    set({
      workspaces: state.workspaces.filter((w) => w.id !== id),
      activeWorkspace: state.activeWorkspace?.id === id ? null : state.activeWorkspace,
    });
  },
}));
