import React from 'react';
import { Play } from 'lucide-react';
import { tabRegistry } from '../../stores/tab-registry';
import { ActionsPanel } from './components/ActionsPanel';
import { ActionOutputView } from './views/ActionOutputView';

export function registerActionsModule() {
  tabRegistry.registerModule({
    id: 'actions',
    label: 'Actions',
    icon: Play,
    panelComponent: ActionsPanel,
    tabDefinitions: [
      {
        type: 'action-output',
        renderContent: () => React.createElement(ActionOutputView),
      },
    ],
  });
}
