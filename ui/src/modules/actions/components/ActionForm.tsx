import React from 'react';
import { Button } from '../../../components/ui/Button';
import { useWorkspaceStore } from '../../../stores/workspace-store';
import { useActionsStore } from '../stores/actions-store';
import { toast } from 'sonner';

export function ActionForm() {
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace);
  const editingAction = useActionsStore((s) => s.editingAction);
  const createAction = useActionsStore((s) => s.createAction);
  const updateAction = useActionsStore((s) => s.updateAction);
  const setShowForm = useActionsStore((s) => s.setShowForm);

  const [name, setName] = React.useState(editingAction?.name ?? '');
  const [command, setCommand] = React.useState(editingAction?.command ?? '');
  const [cwd, setCwd] = React.useState(editingAction?.cwd ?? '');
  const [isLongRunning, setIsLongRunning] = React.useState(editingAction?.is_long_running ?? false);
  const [saving, setSaving] = React.useState(false);

  const handleSave = async () => {
    if (!activeWorkspace || !name.trim() || !command.trim()) return;
    setSaving(true);
    try {
      if (editingAction) {
        await updateAction(activeWorkspace.id, editingAction.id, {
          name: name.trim(),
          command: command.trim(),
          cwd: cwd.trim() || undefined,
          is_long_running: isLongRunning,
        });
      } else {
        await createAction(activeWorkspace.id, {
          name: name.trim(),
          command: command.trim(),
          cwd: cwd.trim() || undefined,
          is_long_running: isLongRunning,
        });
      }
    } catch (err) {
      toast.error(`Failed to save action: ${err}`);
    } finally {
      setSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: 'var(--space-1) var(--space-2)',
    fontSize: '12px',
    fontFamily: 'var(--font-sans)',
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
    outline: 'none',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '11px',
    color: 'var(--text-tertiary)',
    marginBottom: '2px',
    display: 'block',
  };

  return (
    <div style={{ padding: 'var(--space-2) var(--space-3)', borderBottom: '1px solid var(--border)' }}>
      <div style={{ marginBottom: 'var(--space-2)' }}>
        <label style={labelStyle}>Name</label>
        <input
          style={inputStyle}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Action name"
          autoFocus
        />
      </div>
      <div style={{ marginBottom: 'var(--space-2)' }}>
        <label style={labelStyle}>Command</label>
        <textarea
          style={{ ...inputStyle, fontFamily: 'var(--font-mono)', resize: 'vertical', minHeight: '48px' }}
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          placeholder="e.g. npm run build"
          rows={2}
        />
      </div>
      <div style={{ marginBottom: 'var(--space-2)' }}>
        <label style={labelStyle}>Working directory (optional)</label>
        <input
          style={inputStyle}
          value={cwd}
          onChange={(e) => setCwd(e.target.value)}
          placeholder="Leave empty for workspace default"
        />
      </div>
      <div style={{ marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
        <input
          type="checkbox"
          id="action-long-running"
          checked={isLongRunning}
          onChange={(e) => setIsLongRunning(e.target.checked)}
          style={{ margin: 0 }}
        />
        <label htmlFor="action-long-running" style={{ fontSize: '11px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
          Long-running process
        </label>
      </div>
      <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
        <Button size="sm" variant="secondary" onClick={() => setShowForm(false)}>
          Cancel
        </Button>
        <Button size="sm" variant="primary" onClick={handleSave} disabled={saving || !name.trim() || !command.trim()}>
          {editingAction ? 'Save' : 'Create'}
        </Button>
      </div>
    </div>
  );
}
