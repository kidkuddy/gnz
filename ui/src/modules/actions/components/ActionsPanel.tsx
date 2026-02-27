import React from 'react';
import { Plus } from 'lucide-react';
import { PanelSection } from '../../../components/layout/Panel';
import { Button } from '../../../components/ui/Button';
import { useWorkspaceStore } from '../../../stores/workspace-store';
import { useTabStore } from '../../../stores/tab-store';
import { useActionsStore } from '../stores/actions-store';
import { ActionForm } from './ActionForm';
import { ActionItem } from './ActionItem';
import { toast } from 'sonner';

export function ActionsPanel() {
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace);
  const actions = useActionsStore((s) => s.actions);
  const loading = useActionsStore((s) => s.loading);
  const showForm = useActionsStore((s) => s.showForm);
  const runningActionIds = useActionsStore((s) => s.runningActionIds);
  const loadActions = useActionsStore((s) => s.loadActions);
  const runAction = useActionsStore((s) => s.runAction);
  const deleteAction = useActionsStore((s) => s.deleteAction);
  const killRun = useActionsStore((s) => s.killRun);
  const setShowForm = useActionsStore((s) => s.setShowForm);
  const activeRunId = useActionsStore((s) => s.activeRunId);
  const addTab = useTabStore((s) => s.addTab);

  // Track which actionId -> runId for kill
  const [actionRunMap, setActionRunMap] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (activeWorkspace) {
      loadActions(activeWorkspace.id).catch(() => {});
    }
  }, [activeWorkspace, loadActions]);

  const handleRun = async (action: { id: string; name: string }) => {
    if (!activeWorkspace) return;
    try {
      const run = await runAction(activeWorkspace.id, action.id);
      setActionRunMap((prev) => ({ ...prev, [action.id]: run.id }));
      addTab({
        id: `action-output-${run.id}`,
        title: action.name,
        type: 'action-output',
        moduleId: 'actions',
        data: { runId: run.id, actionId: action.id },
      });
    } catch (err) {
      toast.error(`Failed to run action: ${err}`);
    }
  };

  const handleKill = async (actionId: string) => {
    if (!activeWorkspace) return;
    const runId = actionRunMap[actionId] || activeRunId;
    if (!runId) return;
    try {
      await killRun(activeWorkspace.id, runId);
    } catch (err) {
      toast.error(`Failed to kill run: ${err}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!activeWorkspace) return;
    try {
      await deleteAction(activeWorkspace.id, id);
    } catch (err) {
      toast.error(`Failed to delete action: ${err}`);
    }
  };

  if (!activeWorkspace) {
    return (
      <div style={{ padding: 'var(--space-4)', color: 'var(--text-disabled)', fontSize: '12px' }}>
        Select a workspace first
      </div>
    );
  }

  return (
    <PanelSection
      title="Actions"
      action={
        <Button size="sm" variant="secondary" onClick={() => setShowForm(true)} title="New Action">
          <Plus size={12} />
        </Button>
      }
    >
      {showForm && <ActionForm />}
      {loading && actions.length === 0 ? (
        <div
          style={{
            padding: 'var(--space-4) var(--space-3)',
            fontSize: '12px',
            color: 'var(--text-disabled)',
            textAlign: 'center',
          }}
        >
          Loading...
        </div>
      ) : actions.length === 0 ? (
        <div
          style={{
            padding: 'var(--space-4) var(--space-3)',
            fontSize: '12px',
            color: 'var(--text-disabled)',
            textAlign: 'center',
          }}
        >
          No actions yet
        </div>
      ) : (
        actions.map((action) => (
          <ActionItem
            key={action.id}
            action={action}
            runStatus={runningActionIds.has(action.id) ? 'running' : 'idle'}
            onRun={() => handleRun(action)}
            onEdit={() => setShowForm(true, action)}
            onDelete={() => handleDelete(action.id)}
            onKill={() => handleKill(action.id)}
          />
        ))
      )}
    </PanelSection>
  );
}
