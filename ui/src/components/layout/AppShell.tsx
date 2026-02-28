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
  const activeTab = tabs.find((t) => t.id === activeTabId);

  if (!activeTab) {
    return (
      <div style={emptyMainStyle}>
        <span>Open a tab to get started</span>
      </div>
    );
  }

  const def = registry.getTabDefinition(activeTab.type);
  if (!def) {
    return (
      <div style={emptyMainStyle}>
        <span>Unknown tab type</span>
      </div>
    );
  }

  return <>{def.renderContent(activeTab)}</>;
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
