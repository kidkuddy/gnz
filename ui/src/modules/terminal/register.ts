import React from 'react';
import { TerminalSquare } from 'lucide-react';
import { tabRegistry } from '../../stores/tab-registry';
import { useWorkspaceStore } from '../../stores/workspace-store';
import { TerminalPanel } from './components/TerminalPanel';
import { TerminalView } from './views/TerminalView';
import { useTerminalStore } from './stores/terminal-store';

export function registerTerminalModule() {
  tabRegistry.registerModule({
    id: 'terminal',
    label: 'Terminal',
    icon: TerminalSquare,
    panelComponent: TerminalPanel,
    tabDefinitions: [
      {
        type: 'terminal-session',
        renderContent: () => React.createElement(TerminalView),
        onRename: (tab, title) => {
          const sessionId = tab.data?.sessionId as string | undefined;
          if (!sessionId) return;
          const wsId = useWorkspaceStore.getState().activeWorkspace?.id;
          if (!wsId) return;
          useTerminalStore.getState().renameSession(wsId, sessionId, title).catch(() => {});
        },
      },
    ],
  });
}
