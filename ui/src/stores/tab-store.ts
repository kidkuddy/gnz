import { create } from 'zustand';
import { tabRegistry } from './tab-registry';

export interface Tab {
  id: string;
  title: string;
  type: string;
  moduleId: string;
  data?: Record<string, unknown>;
}

interface TabState {
  tabs: Tab[];
  activeTabId: string | null;
  addTab: (tab: Tab) => void;
  removeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  renameTab: (id: string, title: string) => void;
}

export const useTabStore = create<TabState>((set, get) => ({
  tabs: [],
  activeTabId: null,

  addTab: (tab) => {
    const state = get();
    const existing = state.tabs.find((t) => t.id === tab.id);
    if (existing) {
      set({ activeTabId: tab.id });
      return;
    }
    set({ tabs: [...state.tabs, tab], activeTabId: tab.id });
  },

  removeTab: (id) => {
    const state = get();
    const tab = state.tabs.find((t) => t.id === id);
    if (tab) {
      const def = tabRegistry.getTabDefinition(tab.type);
      def?.onClose?.(tab);
    }
    const idx = state.tabs.findIndex((t) => t.id === id);
    const newTabs = state.tabs.filter((t) => t.id !== id);
    let newActiveId = state.activeTabId;
    if (state.activeTabId === id) {
      if (newTabs.length === 0) {
        newActiveId = null;
      } else if (idx >= newTabs.length) {
        newActiveId = newTabs[newTabs.length - 1].id;
      } else {
        newActiveId = newTabs[idx].id;
      }
    }
    set({ tabs: newTabs, activeTabId: newActiveId });
  },

  setActiveTab: (id) => {
    set({ activeTabId: id });
  },

  renameTab: (id, title) => {
    const state = get();
    set({ tabs: state.tabs.map((t) => (t.id === id ? { ...t, title } : t)) });
  },
}));
