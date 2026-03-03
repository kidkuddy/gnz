import React from 'react';
import { LayoutDashboard } from 'lucide-react';
import { tabRegistry } from '../../stores/tab-registry';
import { KanbanPanel } from './components/KanbanPanel';
import { KanbanBoard } from './components/KanbanBoard';
import { kanbanApi } from '../../lib/tauri-ipc';
import { useKanbanStore } from './stores/kanban-store';

export function registerKanbanModule() {
  tabRegistry.registerModule({
    id: 'kanban',
    label: 'Kanban',
    icon: LayoutDashboard,
    panelComponent: KanbanPanel,
    tabDefinitions: [
      {
        type: 'kanban-board',
        renderContent: (tab) =>
          React.createElement(KanbanBoard, {
            boardId: tab.data?.boardId as string,
            workspaceId: tab.data?.workspaceId as string,
          }),
        onRename: (tab, title) => {
          const boardId = tab.data?.boardId as string | undefined;
          const workspaceId = tab.data?.workspaceId as string | undefined;
          if (!boardId || !workspaceId) return;
          kanbanApi.updateBoard(workspaceId, boardId, title).then((updated) => {
            useKanbanStore.setState((s) => ({
              boards: s.boards.map((b) => (b.id === boardId ? { ...b, name: updated.name } : b)),
              activeBoard: s.activeBoard?.id === boardId ? { ...s.activeBoard, name: updated.name } : s.activeBoard,
            }));
          }).catch(() => {});
        },
      },
    ],
  });
}
