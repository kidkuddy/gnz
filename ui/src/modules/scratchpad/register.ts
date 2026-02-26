import React from 'react';
import { StickyNote } from 'lucide-react';
import { tabRegistry } from '../../stores/tab-registry';
import { ScratchpadPanel } from './components/ScratchpadPanel';
import { ScratchpadView } from './views/ScratchpadView';

export function registerScratchpadModule() {
  tabRegistry.registerModule({
    id: 'scratchpad',
    label: 'Scratchpad',
    icon: StickyNote,
    panelComponent: ScratchpadPanel,
    tabDefinitions: [
      {
        type: 'scratchpad',
        renderContent: () => React.createElement(ScratchpadView),
      },
    ],
  });
}
