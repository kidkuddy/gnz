import { create } from 'zustand';
import {
  actionsApi,
  type Action,
  type ActionRun,
  type CreateActionInput,
  type UpdateActionInput,
} from '../../../lib/tauri-ipc';
import { useTabStore } from '../../../stores/tab-store';

interface ActionsStore {
  actions: Action[];
  activeRunId: string | null;
  runs: Record<string, ActionRun[]>;
  runningActionIds: Set<string>;
  loading: boolean;
  showForm: boolean;
  editingAction: Action | null;

  loadActions: (wsId: string) => Promise<void>;
  createAction: (wsId: string, data: CreateActionInput) => Promise<void>;
  updateAction: (wsId: string, id: string, data: UpdateActionInput) => Promise<void>;
  deleteAction: (wsId: string, id: string) => Promise<void>;
  runAction: (wsId: string, actionId: string) => Promise<ActionRun>;
  killRun: (wsId: string, runId: string) => Promise<void>;
  loadRuns: (wsId: string, actionId: string) => Promise<void>;
  setActiveRunId: (id: string | null) => void;
  setShowForm: (show: boolean, action?: Action | null) => void;
  markRunFinished: (actionId: string) => void;
  hasRunningActions: () => boolean;
}

export const useActionsStore = create<ActionsStore>((set, get) => ({
  actions: [],
  activeRunId: null,
  runs: {},
  runningActionIds: new Set(),
  loading: false,
  showForm: false,
  editingAction: null,

  loadActions: async (wsId) => {
    set({ loading: true });
    try {
      const actions = await actionsApi.list(wsId);
      set({ actions: Array.isArray(actions) ? actions : [], loading: false });
    } catch {
      set({ actions: [], loading: false });
    }
  },

  createAction: async (wsId, data) => {
    await actionsApi.create(wsId, data);
    await get().loadActions(wsId);
    set({ showForm: false, editingAction: null });
  },

  updateAction: async (wsId, id, data) => {
    await actionsApi.update(wsId, id, data);
    await get().loadActions(wsId);
    set({ showForm: false, editingAction: null });
  },

  deleteAction: async (wsId, id) => {
    const runs = get().runs[id] || [];
    await actionsApi.delete(wsId, id);
    for (const run of runs) {
      useTabStore.getState().removeTab(`action-output-${run.id}`);
    }
    await get().loadActions(wsId);
  },

  runAction: async (wsId, actionId) => {
    const run = await actionsApi.run(wsId, actionId);
    set((s) => {
      const next = new Set(s.runningActionIds);
      next.add(actionId);
      return { activeRunId: run.id, runningActionIds: next };
    });
    return run;
  },

  killRun: async (wsId, runId) => {
    await actionsApi.killRun(wsId, runId);
    useTabStore.getState().removeTab(`action-output-${runId}`);
  },

  loadRuns: async (wsId, actionId) => {
    try {
      const runs = await actionsApi.listRuns(wsId, actionId);
      set((state) => ({
        runs: { ...state.runs, [actionId]: Array.isArray(runs) ? runs : [] },
      }));
    } catch {
      // ignore
    }
  },

  setActiveRunId: (id) => set({ activeRunId: id }),

  setShowForm: (show, action) =>
    set({ showForm: show, editingAction: action ?? null }),

  markRunFinished: (actionId) =>
    set((s) => {
      const next = new Set(s.runningActionIds);
      next.delete(actionId);
      return { runningActionIds: next };
    }),

  hasRunningActions: () => get().runningActionIds.size > 0,
}));
