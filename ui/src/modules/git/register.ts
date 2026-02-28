import React from 'react';
import { GitBranch } from 'lucide-react';
import { tabRegistry } from '../../stores/tab-registry';
import { GitPanel } from './components/GitPanel';
import { GitHistoryView } from './views/GitHistoryView';
import { GitDiffView } from './views/GitDiffView';
import { GitFileDiffView } from './views/GitFileDiffView';

export function registerGitModule() {
  tabRegistry.registerModule({
    id: 'git',
    label: 'Git',
    icon: GitBranch,
    panelComponent: GitPanel,
    tabDefinitions: [
      {
        type: 'git-history',
        renderContent: () => React.createElement(GitHistoryView),
      },
      {
        type: 'git-diff',
        renderContent: () => React.createElement(GitDiffView),
      },
      {
        type: 'git-file-diff',
        renderContent: () => React.createElement(GitFileDiffView),
      },
    ],
  });
}
