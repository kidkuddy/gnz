import React from 'react';
import { TitleBar } from './TitleBar';
import { ActivityBar } from './ActivityBar';
import { Panel } from './Panel';
import { TabBar } from './TabBar';
import { StatusBar } from './StatusBar';
import { useTabStore } from '../../stores/tab-store';
import { DatabasePanel } from '../../modules/database/components/DatabasePanel';
import { ConnectionView } from '../../modules/database/views/ConnectionView';
import { QueryRunnerView } from '../../modules/database/views/QueryRunnerView';
import { SettingsView } from '../../modules/settings/views/SettingsView';

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
}

function PanelContent({ activeModule }: { activeModule: string }) {
  switch (activeModule) {
    case 'database':
      return <DatabasePanel />;
    case 'settings':
      return (
        <div style={{ padding: 'var(--space-3)', color: 'var(--text-secondary)', fontSize: '12px' }}>
          Settings
        </div>
      );
    default:
      return null;
  }
}

function MainContent() {
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

  switch (activeTab.type) {
    case 'query-runner':
      return <QueryRunnerView />;
    case 'table-browser':
      return (
        <ConnectionView
          tableName={activeTab.data?.tableName as string | undefined}
          connectionId={activeTab.data?.connectionId as string | undefined}
        />
      );
    case 'settings':
      return <SettingsView />;
    default:
      return (
        <div style={emptyMainStyle}>
          <span>Unknown tab type</span>
        </div>
      );
  }
}

export function AppShell({ activeModule, onModuleChange }: AppShellProps) {
  return (
    <div style={shellStyle}>
      <TitleBar />
      <ActivityBar activeModule={activeModule} onModuleChange={onModuleChange} />
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
