import React from 'react';
import { AppShell } from './components/layout/AppShell';
import { WorkspaceSelectorView } from './views/WorkspaceSelectorView';
import { useWorkspaceStore } from './stores/workspace-store';
import { useSettingsStore } from './stores/settings-store';

export function App() {
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace);
  const fetchWorkspaces = useWorkspaceStore((s) => s.fetchWorkspaces);
  const fetchConfig = useSettingsStore((s) => s.fetchConfig);
  const [activeModule, setActiveModule] = React.useState('claude');

  React.useEffect(() => {
    fetchConfig().catch(() => {});
    fetchWorkspaces().catch(() => {});
  }, [fetchConfig, fetchWorkspaces]);

  const handleModuleChange = (moduleId: string) => {
    setActiveModule(moduleId);
  };

  if (!activeWorkspace) {
    return <WorkspaceSelectorView />;
  }

  return (
    <AppShell activeModule={activeModule} onModuleChange={handleModuleChange} />
  );
}
