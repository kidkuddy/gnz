import React from 'react';
import { Database } from 'lucide-react';
import { tabRegistry } from '../../stores/tab-registry';
import { DatabasePanel } from './components/DatabasePanel';
import { ConnectionView } from './views/ConnectionView';
import { QueryRunnerView } from './views/QueryRunnerView';
import type { Tab } from '../../stores/tab-store';

export function registerDatabaseModule() {
  tabRegistry.registerModule({
    id: 'database',
    label: 'Database',
    icon: Database,
    panelComponent: DatabasePanel,
    tabDefinitions: [
      {
        type: 'table-browser',
        renderContent: (tab: Tab) =>
          React.createElement(ConnectionView, {
            tableName: tab.data?.tableName as string | undefined,
            connectionId: tab.data?.connectionId as string | undefined,
          }),
      },
      {
        type: 'query-runner',
        renderContent: () => React.createElement(QueryRunnerView),
      },
    ],
  });
}
