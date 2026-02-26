import React from 'react';
import { TerminalSquare } from 'lucide-react';
import { tabRegistry } from '../../stores/tab-registry';
import { TerminalPanel } from './components/TerminalPanel';
import { TerminalView } from './views/TerminalView';

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
      },
    ],
  });
}
