import React from 'react';
import { Sparkles } from 'lucide-react';
import { tabRegistry } from '../../stores/tab-registry';
import { GalactaPanel } from './components/GalactaPanel';
import { GalactaSessionView } from './views/GalactaSessionView';
import { GalactaPreviewView } from './views/GalactaPreviewView';
import { GalactaLogsView } from './views/GalactaLogsView';
import { useGalactaStore } from './stores/galacta-store';

export function registerGalactaModule() {
  tabRegistry.registerModule({
    id: 'galacta',
    label: 'Galacta',
    icon: Sparkles,
    panelComponent: GalactaPanel,
    tabDefinitions: [
      {
        type: 'galacta-session',
        renderContent: () => React.createElement(GalactaSessionView),
        onRename: (tab, title) => {
          const sessionId = tab.data?.sessionId as string | undefined;
          const workspaceId = tab.data?.workspaceId as string | undefined;
          if (!sessionId || !workspaceId) return;
          useGalactaStore.getState().renameSession(workspaceId, sessionId, title);
        },
      },
      {
        type: 'galacta-preview',
        renderContent: () => React.createElement(GalactaPreviewView),
      },
      {
        type: 'galacta-logs',
        renderContent: () => React.createElement(GalactaLogsView),
      },
    ],
  });
}
