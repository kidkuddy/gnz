import React from 'react';
import { useSyncExternalStore } from 'react';
import type { Tab } from './tab-store';

export interface TabDefinition {
  type: string;
  renderContent: (tab: Tab) => React.ReactNode;
  onClose?: (tab: Tab) => void;
  onRename?: (tab: Tab, title: string) => void;
}

export interface ModuleDefinition {
  id: string;
  label: string;
  icon: React.ComponentType<{ size: number; strokeWidth?: number }>;
  panelComponent?: React.ComponentType;
  tabDefinitions: TabDefinition[];
}

class TabRegistry {
  private modules: ModuleDefinition[] = [];
  private tabDefs = new Map<string, TabDefinition>();
  private listeners = new Set<() => void>();
  private version = 0;

  registerModule(module: ModuleDefinition) {
    this.modules.push(module);
    for (const td of module.tabDefinitions) {
      this.tabDefs.set(td.type, td);
    }
    this.version++;
    this.listeners.forEach((l) => l());
  }

  getModule(id: string): ModuleDefinition | undefined {
    return this.modules.find((m) => m.id === id);
  }

  getModules(): ModuleDefinition[] {
    return this.modules;
  }

  getTabDefinition(type: string): TabDefinition | undefined {
    return this.tabDefs.get(type);
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.version;
}

export const tabRegistry = new TabRegistry();

export function useTabRegistry(): TabRegistry {
  useSyncExternalStore(tabRegistry.subscribe, tabRegistry.getSnapshot);
  return tabRegistry;
}
