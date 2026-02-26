import React from 'react';
import { Plus, TerminalSquare, Trash2 } from 'lucide-react';
import { PanelSection } from '../../../components/layout/Panel';
import { Button } from '../../../components/ui/Button';
import { useWorkspaceStore } from '../../../stores/workspace-store';
import { useTabStore } from '../../../stores/tab-store';
import { useTerminalStore } from '../stores/terminal-store';
import { parseWorkspaceSettings } from '../../../lib/tauri-ipc';
import { toast } from 'sonner';

export function TerminalPanel() {
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace);
  const sessions = useTerminalStore((s) => s.sessions);
  const activeSessionId = useTerminalStore((s) => s.activeSessionId);
  const loadSessions = useTerminalStore((s) => s.loadSessions);
  const createSession = useTerminalStore((s) => s.createSession);
  const deleteSession = useTerminalStore((s) => s.deleteSession);
  const setActiveSession = useTerminalStore((s) => s.setActiveSession);
  const addTab = useTabStore((s) => s.addTab);

  React.useEffect(() => {
    if (activeWorkspace) {
      loadSessions(activeWorkspace.id).catch(() => {});
    }
  }, [activeWorkspace, loadSessions]);

  const handleNew = async () => {
    if (!activeWorkspace) return;
    try {
      const settings = parseWorkspaceSettings(activeWorkspace.settings);
      const sess = await createSession(activeWorkspace.id, settings.working_directory);
      setActiveSession(sess.id);
      addTab({
        id: `terminal-${sess.id}`,
        title: sess.name,
        type: 'terminal-session',
        moduleId: 'terminal',
        data: { sessionId: sess.id },
      });
    } catch (err) {
      toast.error(`Failed to create terminal: ${err}`);
    }
  };

  const handleSelect = (sess: { id: string; name: string }) => {
    setActiveSession(sess.id);
    addTab({
      id: `terminal-${sess.id}`,
      title: sess.name,
      type: 'terminal-session',
      moduleId: 'terminal',
      data: { sessionId: sess.id },
    });
  };

  const handleDelete = async (id: string) => {
    if (!activeWorkspace) return;
    try {
      await deleteSession(activeWorkspace.id, id);
    } catch (err) {
      toast.error(`Failed to delete terminal: ${err}`);
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
      title="Terminals"
      action={
        <Button size="sm" variant="secondary" onClick={handleNew} title="New Terminal">
          <Plus size={12} />
        </Button>
      }
    >
      {sessions.length === 0 ? (
        <div
          style={{
            padding: 'var(--space-4) var(--space-3)',
            fontSize: '12px',
            color: 'var(--text-disabled)',
            textAlign: 'center',
          }}
        >
          No terminals yet
        </div>
      ) : (
        sessions.map((sess) => (
          <TerminalItem
            key={sess.id}
            name={sess.name}
            status={sess.status}
            shell={sess.shell}
            isActive={activeSessionId === sess.id}
            onSelect={() => handleSelect(sess)}
            onDelete={() => handleDelete(sess.id)}
          />
        ))
      )}
    </PanelSection>
  );
}

interface TerminalItemProps {
  name: string;
  status: string;
  shell: string;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

function TerminalItem({ name, status, shell, isActive, onSelect, onDelete }: TerminalItemProps) {
  const [hovered, setHovered] = React.useState(false);

  const shellName = shell.split('/').pop() || shell;

  const itemStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-2)',
    padding: 'var(--space-2) var(--space-3)',
    cursor: 'pointer',
    background: isActive ? 'var(--accent-muted)' : hovered ? 'var(--bg-hover)' : 'transparent',
    transition: 'background 80ms ease',
  };

  const nameStyle: React.CSSProperties = {
    flex: 1,
    fontSize: '12px',
    color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  };

  const statusDotStyle: React.CSSProperties = {
    width: '4px',
    height: '4px',
    borderRadius: '50%',
    background: status === 'running' ? 'var(--text-secondary)' : 'var(--text-disabled)',
    flexShrink: 0,
  };

  return (
    <div
      style={itemStyle}
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <TerminalSquare size={13} style={{ flexShrink: 0, color: 'var(--text-tertiary)' }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={nameStyle}>{name}</span>
        <div style={{ fontSize: '10px', color: 'var(--text-disabled)', marginTop: '1px' }}>
          {shellName}
        </div>
      </div>
      <span style={statusDotStyle} title={status} />
      {hovered && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-tertiary)',
            padding: 0,
          }}
          title="Delete terminal"
        >
          <Trash2 size={12} />
        </button>
      )}
    </div>
  );
}
