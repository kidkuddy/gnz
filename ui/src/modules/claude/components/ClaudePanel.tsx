import React from 'react';
import { Plus, MessageSquare, Trash2 } from 'lucide-react';
import { PanelSection } from '../../../components/layout/Panel';
import { Button } from '../../../components/ui/Button';
import { useWorkspaceStore } from '../../../stores/workspace-store';
import { useTabStore } from '../../../stores/tab-store';
import { useSessionStore } from '../stores/session-store';
import { parseWorkspaceSettings } from '../../../lib/tauri-ipc';
import { toast } from 'sonner';

export function ClaudePanel() {
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace);
  const sessions = useSessionStore((s) => s.sessions);
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const loadSessions = useSessionStore((s) => s.loadSessions);
  const createSession = useSessionStore((s) => s.createSession);
  const deleteSession = useSessionStore((s) => s.deleteSession);
  const setActiveSession = useSessionStore((s) => s.setActiveSession);
  const addTab = useTabStore((s) => s.addTab);

  React.useEffect(() => {
    if (activeWorkspace) {
      loadSessions(activeWorkspace.id).catch(() => {});
    }
  }, [activeWorkspace, loadSessions]);

  const handleNewSession = async () => {
    if (!activeWorkspace) return;
    try {
      const settings = parseWorkspaceSettings(activeWorkspace.settings);
      const sess = await createSession(activeWorkspace.id, undefined, settings.working_directory);
      setActiveSession(sess.id);
      addTab({
        id: `claude-${sess.id}`,
        title: sess.name,
        type: 'claude-session',
        moduleId: 'claude',
        data: { sessionId: sess.id },
      });
    } catch (err) {
      toast.error(`Failed to create session: ${err}`);
    }
  };

  const handleSelectSession = (sess: { id: string; name: string }) => {
    setActiveSession(sess.id);
    addTab({
      id: `claude-${sess.id}`,
      title: sess.name,
      type: 'claude-session',
      moduleId: 'claude',
      data: { sessionId: sess.id },
    });
  };

  const handleDeleteSession = async (id: string) => {
    if (!activeWorkspace) return;
    try {
      await deleteSession(activeWorkspace.id, id);
    } catch (err) {
      toast.error(`Failed to delete session: ${err}`);
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
      title="Sessions"
      action={
        <Button size="sm" variant="secondary" onClick={handleNewSession} title="New Session">
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
          No sessions yet
        </div>
      ) : (
        sessions.map((sess) => (
          <SessionItem
            key={sess.id}
            name={sess.name}
            status={sess.status}
            isActive={activeSessionId === sess.id}
            onSelect={() => handleSelectSession(sess)}
            onDelete={() => handleDeleteSession(sess.id)}
          />
        ))
      )}
    </PanelSection>
  );
}

interface SessionItemProps {
  name: string;
  status: string;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

function SessionItem({ name, status, isActive, onSelect, onDelete }: SessionItemProps) {
  const [hovered, setHovered] = React.useState(false);

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
    color: isActive ? 'var(--accent-text)' : 'var(--text-secondary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  };

  const statusDotStyle: React.CSSProperties = {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    background: status === 'running' ? 'var(--status-success)' : 'var(--border-strong)',
    flexShrink: 0,
  };

  return (
    <div
      style={itemStyle}
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <MessageSquare size={13} style={{ flexShrink: 0, color: 'var(--text-tertiary)' }} />
      <span style={nameStyle}>{name}</span>
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
          title="Delete session"
        >
          <Trash2 size={12} />
        </button>
      )}
    </div>
  );
}
