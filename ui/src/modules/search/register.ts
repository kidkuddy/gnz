import React from 'react';
import { Search } from 'lucide-react';
import { tabRegistry } from '../../stores/tab-registry';
import { SearchPanel } from './components/SearchPanel';
import { FileView } from './views/FileView';
import type { Tab } from '../../stores/tab-store';

export function registerSearchModule() {
  tabRegistry.registerModule({
    id: 'search',
    label: 'Search',
    icon: Search,
    panelComponent: SearchPanel,
    tabDefinitions: [
      {
        type: 'file-viewer',
        renderContent: (_tab: Tab) => React.createElement(FileView),
      },
    ],
  });
}
