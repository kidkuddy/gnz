import React from 'react';
import type { KanbanCard, KanbanSubtask } from '../../../lib/tauri-ipc';
import { useKanbanStore } from '../stores/kanban-store';
import { SubtaskItem } from './SubtaskItem';
import { useTabStore } from '../../../stores/tab-store';
import { toast } from 'sonner';

interface SubtaskListProps {
  card: KanbanCard;
  workspaceId: string;
  subtasks: KanbanSubtask[] | undefined;
  onLoad: () => void;
}

export function SubtaskList({ card, workspaceId, subtasks, onLoad }: SubtaskListProps) {
  const createSubtask = useKanbanStore((s) => s.createSubtask);
  const updateSubtask = useKanbanStore((s) => s.updateSubtask);
  const deleteSubtask = useKanbanStore((s) => s.deleteSubtask);
  const launchSubtask = useKanbanStore((s) => s.launchSubtask);
  const retrySubtask = useKanbanStore((s) => s.retrySubtask);

  const [newTitle, setNewTitle] = React.useState('');
  const [adding, setAdding] = React.useState(false);

  React.useEffect(() => {
    onLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.id]);

  const handleAdd = async () => {
    if (!newTitle.trim()) return;
    try {
      await createSubtask(workspaceId, card.id, newTitle.trim(), '', []);
      setNewTitle('');
      setAdding(false);
    } catch (err) {
      toast.error(`Failed to create subtask: ${err}`);
    }
  };

  const handleLaunch = async (subId: string) => {
    try {
      await launchSubtask(workspaceId, card.id, subId);
    } catch (err) {
      toast.error(`Failed to launch subtask: ${err}`);
    }
  };

  const handleRetry = async (subId: string) => {
    try {
      await retrySubtask(workspaceId, card.id, subId);
    } catch (err) {
      toast.error(`Failed to retry subtask: ${err}`);
    }
  };

  const handleOpenSession = (sessionId: string, subtaskTitle: string) => {
    useTabStore.getState().addTab({
      id: `galacta-${sessionId}`,
      title: subtaskTitle,
      type: 'galacta-session',
      moduleId: 'galacta',
      data: { sessionId, workspaceId },
    });
  };

  const list = subtasks ?? [];

  return (
    <div style={{ marginTop: 'var(--space-3)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
        <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', fontWeight: 500 }}>
          Sub-tasks {list.length > 0 ? `(${list.length})` : ''}
        </span>
        <button
          onClick={() => setAdding((v) => !v)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: '11px', padding: '2px 4px' }}
        >
          + Add
        </button>
      </div>

      {adding && (
        <div style={{ display: 'flex', gap: 'var(--space-1)', marginBottom: 'var(--space-2)' }}>
          <input
            autoFocus
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAdd();
              if (e.key === 'Escape') setAdding(false);
            }}
            placeholder="Sub-task title…"
            style={{
              flex: 1,
              background: 'var(--bg-base)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-primary)',
              fontSize: '12px',
              padding: '4px 8px',
              fontFamily: 'var(--font-sans)',
              outline: 'none',
            }}
          />
          <button
            onClick={handleAdd}
            style={{
              background: 'var(--bg-active)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-secondary)',
              fontSize: '12px',
              padding: '4px 10px',
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
            }}
          >
            Add
          </button>
        </div>
      )}

      {list.length === 0 && !adding && (
        <div style={{ fontSize: '11px', color: 'var(--text-disabled)', paddingBottom: 'var(--space-1)' }}>
          No sub-tasks yet
        </div>
      )}

      <div style={{ border: list.length > 0 ? '1px solid var(--border-subtle)' : 'none', borderRadius: 'var(--radius-sm)' }}>
        {list.map((subtask) => (
          <SubtaskItem
            key={subtask.id}
            subtask={subtask}
            allSubtasks={list}
            workspaceId={workspaceId}
            cardId={card.id}
            onUpdate={(patch) => updateSubtask(workspaceId, card.id, subtask.id, patch)}
            onDelete={() => deleteSubtask(workspaceId, card.id, subtask.id)}
            onLaunch={() => handleLaunch(subtask.id)}
            onRetry={() => handleRetry(subtask.id)}
            onOpenSession={() =>
              subtask.session_id
                ? handleOpenSession(subtask.session_id, subtask.title)
                : undefined
            }
          />
        ))}
      </div>
    </div>
  );
}
