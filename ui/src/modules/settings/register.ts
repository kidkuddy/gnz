import React from 'react';
import { Settings } from 'lucide-react';
import { tabRegistry } from '../../stores/tab-registry';
import { SettingsView } from './views/SettingsView';

export function registerSettingsModule() {
  tabRegistry.registerModule({
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    tabDefinitions: [
      {
        type: 'settings',
        renderContent: () => React.createElement(SettingsView),
      },
    ],
  });
}
