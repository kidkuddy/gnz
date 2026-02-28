import React from 'react';
import { TitleBar } from './TitleBar';
import { ActivityBar } from './ActivityBar';
import { Panel } from './Panel';
import { TabBar } from './TabBar';
import { StatusBar } from './StatusBar';
import { useTabStore } from '../../stores/tab-store';
import { useTabRegistry } from '../../stores/tab-registry';
import { useActionsStore } from '../../modules/actions/stores/actions-store';

const shellStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'var(--activity-bar-width) var(--panel-width) 1fr',
  gridTemplateRows: 'var(--titlebar-height) var(--tabbar-height) 1fr var(--statusbar-height)',
  gridTemplateAreas: `
    "titlebar titlebar titlebar"
    "activity-bar panel tabs"
    "activity-bar panel main"
    "statusbar statusbar statusbar"
  `,
  height: '100vh',
  width: '100vw',
  overflow: 'hidden',
  background: 'var(--bg-base)',
};

const mainStyle: React.CSSProperties = {
  gridArea: 'main',
  overflow: 'hidden',
  background: 'var(--bg-base)',
};

const emptyMainStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  color: 'var(--text-disabled)',
  fontFamily: 'var(--font-mono)',
  fontSize: '13px',
};

interface AppShellProps {
  activeModule: string;
  onModuleChange: (moduleId: string) => void;
  panelOpen: boolean;
}

function PanelContent({ activeModule }: { activeModule: string }) {
  const registry = useTabRegistry();
  const mod = registry.getModule(activeModule);
  if (!mod?.panelComponent) {
    return (
      <div style={{ padding: 'var(--space-3)', color: 'var(--text-secondary)', fontSize: '12px' }}>
        {mod?.label || activeModule}
      </div>
    );
  }
  const PanelComp = mod.panelComponent;
  return <PanelComp />;
}

function MainContent() {
  const registry = useTabRegistry();
  const activeTabId = useTabStore((s) => s.activeTabId);
  const tabs = useTabStore((s) => s.tabs);

  // Track which tabs have been mounted at least once — keeps them alive after first visit
  const [mounted, setMounted] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    if (activeTabId) {
      setMounted((prev) => {
        if (prev.has(activeTabId)) return prev;
        const next = new Set(prev);
        next.add(activeTabId);
        return next;
      });
    }
  }, [activeTabId]);

  // Remove from mounted when tab is closed
  React.useEffect(() => {
    const tabIdSet = new Set(tabs.map((t) => t.id));
    setMounted((prev) => {
      const next = new Set([...prev].filter((id) => tabIdSet.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [tabs]);

  if (tabs.length === 0) {
    return (
      <div style={emptyMainStyle}>
        <span>Open a tab to get started</span>
      </div>
    );
  }

  return (
    <>
      {tabs
        .filter((tab) => mounted.has(tab.id))
        .map((tab) => {
          const def = registry.getTabDefinition(tab.type);
          if (!def) return null;
          return (
            <div
              key={tab.id}
              style={{
                width: '100%',
                height: '100%',
                display: tab.id === activeTabId ? 'flex' : 'none',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              {def.renderContent(tab)}
            </div>
          );
        })}
    </>
  );
}

export function AppShell({ activeModule, onModuleChange, panelOpen }: AppShellProps) {
  const hasRunningActions = useActionsStore((s) => s.runningActionIds.size > 0);
  const badges: Record<string, boolean> = hasRunningActions ? { actions: true } : {};

  const dynamicShellStyle: React.CSSProperties = {
    ...shellStyle,
    gridTemplateColumns: `var(--activity-bar-width) ${panelOpen ? 'var(--panel-width)' : '0px'} 1fr`,
    transition: 'grid-template-columns 150ms ease',
  };

  return (
    <div style={dynamicShellStyle}>
      <TitleBar />
      <ActivityBar activeModule={activeModule} onModuleChange={onModuleChange} badges={badges} />
      <Panel>
        <PanelContent activeModule={activeModule} />
      </Panel>
      <TabBar />
      <div style={mainStyle}>
        <MainContent />
      </div>
      <StatusBar />
    </div>
  );
}
