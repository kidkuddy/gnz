import React from 'react';
import { Bot } from 'lucide-react';
import { tabRegistry } from '../../stores/tab-registry';
import { ClaudePanel } from './components/ClaudePanel';
import { ClaudeSessionView } from './views/ClaudeSessionView';

export function registerClaudeModule() {
  tabRegistry.registerModule({
    id: 'claude',
    label: 'Claude Code',
    icon: Bot,
    panelComponent: ClaudePanel,
    tabDefinitions: [
      {
        type: 'claude-session',
        renderContent: () => React.createElement(ClaudeSessionView),
      },
    ],
  });
}
