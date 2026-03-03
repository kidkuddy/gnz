import { create } from 'zustand';
import {
  kanbanApi,
  type KanbanBoard,
  type KanbanCard,
  type KanbanColumn,
  type KanbanLabel,
  type KanbanSubtask,
} from '../../../lib/tauri-ipc';

interface KanbanStore {
  boards: KanbanBoard[];
  activeBoard: KanbanBoard | null;
  columns: KanbanColumn[];
  cards: KanbanCard[];
  labels: KanbanLabel[];
  subtasks: Record<string, KanbanSubtask[]>; // cardId -> subtasks
  loading: boolean;
  selectedCardId: string | null;

  loadBoards: (workspaceId: string) => Promise<void>;
  loadBoard: (workspaceId: string, boardId: string) => Promise<void>;
  setActiveBoard: (board: KanbanBoard | null) => void;

  createCard: (workspaceId: string, boardId: string, columnId: string, title: string) => Promise<void>;
  updateCard: (workspaceId: string, boardId: string, cardId: string, patch: Partial<KanbanCard>) => Promise<void>;
  moveCard: (workspaceId: string, boardId: string, cardId: string, toColumnId: string, toPosition: number) => Promise<void>;
  deleteCard: (workspaceId: string, boardId: string, cardId: string) => Promise<void>;

  toggleColumnVisibility: (workspaceId: string, boardId: string, colId: string, visible: boolean) => Promise<void>;
  createColumn: (workspaceId: string, boardId: string, name: string) => Promise<void>;
  deleteColumn: (workspaceId: string, boardId: string, colId: string) => Promise<void>;

  searchLabels: (workspaceId: string, boardId: string, q: string) => Promise<KanbanLabel[]>;
  createLabel: (workspaceId: string, boardId: string, name: string) => Promise<KanbanLabel>;
  attachLabel: (workspaceId: string, boardId: string, cardId: string, labelId: string) => Promise<void>;
  detachLabel: (workspaceId: string, boardId: string, cardId: string, labelId: string) => Promise<void>;

  loadSubtasks: (workspaceId: string, cardId: string) => Promise<void>;
  createSubtask: (workspaceId: string, cardId: string, title: string, prompt: string, contextDeps: string[]) => Promise<void>;
  updateSubtask: (workspaceId: string, cardId: string, subId: string, patch: Partial<KanbanSubtask>) => Promise<void>;
  deleteSubtask: (workspaceId: string, cardId: string, subId: string) => Promise<void>;
  launchSubtask: (workspaceId: string, cardId: string, subId: string) => Promise<{ id: string; name: string }>;
  retrySubtask: (workspaceId: string, cardId: string, subId: string) => Promise<{ id: string; name: string }>;

  selectCard: (cardId: string | null) => void;
}

export const useKanbanStore = create<KanbanStore>((set, get) => ({
  boards: [],
  activeBoard: null,
  columns: [],
  cards: [],
  labels: [],
  subtasks: {},
  loading: false,
  selectedCardId: null,

  loadBoards: async (workspaceId) => {
    set({ loading: true });
    try {
      const boards = await kanbanApi.listBoards(workspaceId);
      const safeBoards = Array.isArray(boards) ? boards : [];
      const current = get().activeBoard;
      const active = current ?? safeBoards[0] ?? null;
      set({ boards: safeBoards, activeBoard: active, loading: false });
      if (active) {
        await get().loadBoard(workspaceId, active.id);
      }
    } catch {
      set({ boards: [], loading: false });
    }
  },

  loadBoard: async (workspaceId, boardId) => {
    set({ loading: true });
    try {
      const [columns, cards] = await Promise.all([
        kanbanApi.listColumns(workspaceId, boardId),
        kanbanApi.listCards(workspaceId, boardId),
      ]);
      set({
        columns: Array.isArray(columns) ? columns : [],
        cards: Array.isArray(cards) ? cards : [],
        loading: false,
      });
    } catch {
      set({ loading: false });
    }
  },

  setActiveBoard: (board) => set({ activeBoard: board }),

  createCard: async (workspaceId, boardId, columnId, title) => {
    const card = await kanbanApi.createCard(workspaceId, boardId, { column_id: columnId, title });
    set((s) => ({ cards: [...s.cards, card] }));
  },

  updateCard: async (workspaceId, boardId, cardId, patch) => {
    const updated = await kanbanApi.updateCard(workspaceId, boardId, cardId, patch);
    set((s) => ({
      cards: s.cards.map((c) => (c.id === cardId ? { ...c, ...updated } : c)),
    }));
  },

  moveCard: async (workspaceId, boardId, cardId, toColumnId, toPosition) => {
    // Optimistic update
    const prevCards = get().cards;
    set((s) => ({
      cards: s.cards.map((c) =>
        c.id === cardId ? { ...c, column_id: toColumnId, position: toPosition } : c
      ),
    }));
    try {
      const updated = await kanbanApi.updateCard(workspaceId, boardId, cardId, {
        column_id: toColumnId,
        position: toPosition,
      });
      set((s) => ({
        cards: s.cards.map((c) => (c.id === cardId ? { ...c, ...updated } : c)),
      }));
    } catch {
      // Revert on error
      set({ cards: prevCards });
    }
  },

  deleteCard: async (workspaceId, boardId, cardId) => {
    await kanbanApi.deleteCard(workspaceId, boardId, cardId);
    set((s) => ({
      cards: s.cards.filter((c) => c.id !== cardId),
      selectedCardId: s.selectedCardId === cardId ? null : s.selectedCardId,
    }));
  },

  toggleColumnVisibility: async (workspaceId, boardId, colId, visible) => {
    await kanbanApi.updateColumn(workspaceId, boardId, colId, { visible });
    set((s) => ({
      columns: s.columns.map((col) => (col.id === colId ? { ...col, visible } : col)),
    }));
  },

  createColumn: async (workspaceId, boardId, name) => {
    const cols = get().columns.filter((c) => c.board_id === boardId);
    const nextPos = cols.length > 0 ? Math.max(...cols.map((c) => c.position)) + 1 : 0;
    const col = await kanbanApi.createColumn(workspaceId, boardId, name, nextPos);
    set((s) => ({ columns: [...s.columns, col] }));
  },

  deleteColumn: async (workspaceId, boardId, colId) => {
    // Move all cards in this column to the first remaining column ("Unset" fallback)
    const remaining = get().columns.filter((c) => c.board_id === boardId && c.id !== colId);
    const target = remaining[0];
    if (target) {
      const displaced = get().cards.filter((c) => c.column_id === colId);
      for (const card of displaced) {
        await kanbanApi.updateCard(workspaceId, boardId, card.id, { column_id: target.id });
      }
      set((s) => ({
        cards: s.cards.map((c) => c.column_id === colId ? { ...c, column_id: target.id } : c),
      }));
    }
    await kanbanApi.deleteColumn(workspaceId, boardId, colId);
    set((s) => ({ columns: s.columns.filter((c) => c.id !== colId) }));
  },

  searchLabels: async (workspaceId, boardId, q) => {
    return kanbanApi.searchLabels(workspaceId, boardId, q);
  },

  createLabel: async (workspaceId, boardId, name) => {
    return kanbanApi.createLabel(workspaceId, boardId, name);
  },

  attachLabel: async (workspaceId, boardId, cardId, labelId) => {
    await kanbanApi.attachLabel(workspaceId, boardId, cardId, labelId);
    // reload labels for this card from store state
    set((s) => {
      const label = s.labels.find((l) => l.id === labelId);
      if (!label) return s;
      return {
        cards: s.cards.map((c) => {
          if (c.id !== cardId) return c;
          const alreadyHas = c.labels.some((l) => l.id === labelId);
          if (alreadyHas) return c;
          return { ...c, labels: [...c.labels, label] };
        }),
      };
    });
  },

  detachLabel: async (workspaceId, boardId, cardId, labelId) => {
    await kanbanApi.detachLabel(workspaceId, boardId, cardId, labelId);
    set((s) => ({
      cards: s.cards.map((c) =>
        c.id === cardId ? { ...c, labels: c.labels.filter((l) => l.id !== labelId) } : c
      ),
    }));
  },

  loadSubtasks: async (workspaceId, cardId) => {
    try {
      const subtasks = await kanbanApi.listSubtasks(workspaceId, cardId);
      set((s) => ({
        subtasks: { ...s.subtasks, [cardId]: Array.isArray(subtasks) ? subtasks : [] },
      }));
    } catch {
      // ignore
    }
  },

  createSubtask: async (workspaceId, cardId, title, prompt, contextDeps) => {
    const subtask = await kanbanApi.createSubtask(workspaceId, cardId, {
      title,
      prompt,
      context_deps: contextDeps,
    });
    set((s) => ({
      subtasks: {
        ...s.subtasks,
        [cardId]: [...(s.subtasks[cardId] ?? []), subtask],
      },
    }));
  },

  updateSubtask: async (workspaceId, cardId, subId, patch) => {
    const updated = await kanbanApi.updateSubtask(workspaceId, cardId, subId, patch);
    set((s) => ({
      subtasks: {
        ...s.subtasks,
        [cardId]: (s.subtasks[cardId] ?? []).map((st) => (st.id === subId ? { ...st, ...updated } : st)),
      },
    }));
  },

  deleteSubtask: async (workspaceId, cardId, subId) => {
    await kanbanApi.deleteSubtask(workspaceId, cardId, subId);
    set((s) => ({
      subtasks: {
        ...s.subtasks,
        [cardId]: (s.subtasks[cardId] ?? []).filter((st) => st.id !== subId),
      },
    }));
  },

  launchSubtask: async (workspaceId, cardId, subId) => {
    const session = await kanbanApi.launchSubtask(workspaceId, cardId, subId);
    // Update subtask session_id + status in store — do NOT open a tab
    set((s) => ({
      subtasks: {
        ...s.subtasks,
        [cardId]: (s.subtasks[cardId] ?? []).map((st) =>
          st.id === subId ? { ...st, session_id: session.id, status: 'running' as const } : st
        ),
      },
    }));
    return { id: session.id, name: session.name };
  },

  retrySubtask: async (workspaceId, cardId, subId) => {
    // Reset status to pending so launch is re-enabled, then launch again
    await kanbanApi.updateSubtask(workspaceId, cardId, subId, {});
    set((s) => ({
      subtasks: {
        ...s.subtasks,
        [cardId]: (s.subtasks[cardId] ?? []).map((st) =>
          st.id === subId ? { ...st, session_id: null, status: 'pending' as const } : st
        ),
      },
    }));
    // Re-launch
    const session = await kanbanApi.launchSubtask(workspaceId, cardId, subId);
    set((s) => ({
      subtasks: {
        ...s.subtasks,
        [cardId]: (s.subtasks[cardId] ?? []).map((st) =>
          st.id === subId ? { ...st, session_id: session.id, status: 'running' as const } : st
        ),
      },
    }));
    return { id: session.id, name: session.name };
  },

  selectCard: (cardId) => set({ selectedCardId: cardId }),
}));
