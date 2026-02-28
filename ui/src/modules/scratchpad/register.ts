import React from 'react';
import { StickyNote } from 'lucide-react';
import { tabRegistry } from '../../stores/tab-registry';
import { ScratchpadPanel } from './components/ScratchpadPanel';
import { ScratchpadView } from './views/ScratchpadView';
import { useWorkspaceStore } from '../../stores/workspace-store';
import { useScratchpadStore } from './stores/scratchpad-store';

export function registerScratchpadModule() {
  tabRegistry.registerModule({
    id: 'scratchpad',
    label: 'Scratchpad',
    icon: StickyNote,
    panelComponent: ScratchpadPanel,
    tabDefinitions: [
      {
        type: 'scratchpad',
        renderContent: (tab) => React.createElement(ScratchpadView, { tab }),
        onRename: (tab, title) => {
          const padId = tab.data?.padId as string | undefined;
          if (!padId) return;
          const wsId = useWorkspaceStore.getState().activeWorkspace?.id;
          if (!wsId) return;
          useScratchpadStore.getState().renamePad(wsId, padId, title).catch(() => {});
        },
      },
    ],
  });
}
