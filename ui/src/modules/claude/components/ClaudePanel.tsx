import React from 'react';
import { Plus, MessageSquare, Trash2 } from 'lucide-react';
import { PanelSection } from '../../../components/layout/Panel';
import { Button } from '../../../components/ui/Button';
import { useWorkspaceStore } from '../../../stores/workspace-store';
import { useTabStore } from '../../../stores/tab-store';
import { useSessionStore } from '../stores/session-store';
import { parseWorkspaceSettings, type PermissionMode } from '../../../lib/tauri-ipc';
import { toast } from 'sonner';

const PERMISSION_MODES: { value: PermissionMode; label: string; description: string }[] = [
  { value: 'acceptEdits', label: 'Accept Edits', description: 'Auto-accept file edits, prompt for shell' },
  { value: 'default', label: 'Default', description: 'Prompt for all tool use' },
  { value: 'plan', label: 'Plan', description: 'Plan mode — read-only exploration' },
  { value: 'dontAsk', label: "Don't Ask", description: 'Accept edits and most shell commands' },
  { value: 'bypassPermissions', label: 'Bypass All', description: 'Skip all permission checks' },
];

export function ClaudePanel() {
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace);
  const sessions = useSessionStore((s) => s.sessions);
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const loadSessions = useSessionStore((s) => s.loadSessions);
  const createSession = useSessionStore((s) => s.createSession);
  const deleteSession = useSessionStore((s) => s.deleteSession);
  const setActiveSession = useSessionStore((s) => s.setActiveSession);
  const updatePermissionMode = useSessionStore((s) => s.updatePermissionMode);
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

  const handlePermissionModeChange = async (sessionId: string, mode: PermissionMode) => {
    if (!activeWorkspace) return;
    try {
      await updatePermissionMode(activeWorkspace.id, sessionId, mode);
    } catch (err) {
      toast.error(`Failed to update permission mode: ${err}`);
    }
  };

  if (!activeWorkspace) {
    return (
      <div style={{ padding: 'var(--space-4)', color: 'var(--text-disabled)', fontSize: '12px' }}>
        Select a workspace first
      </div>
    );
  }

  const activeSession = sessions.find((s) => s.id === activeSessionId);

  return (
    <>
      {activeSession && (
        <div style={{ padding: 'var(--space-2) var(--space-3)' }}>
          <PermissionModeSelect
            value={activeSession.permission_mode}
            onChange={(mode) => handlePermissionModeChange(activeSession.id, mode)}
          />
        </div>
      )}
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
              permissionMode={sess.permission_mode}
              isActive={activeSessionId === sess.id}
              onSelect={() => handleSelectSession(sess)}
              onDelete={() => handleDeleteSession(sess.id)}
            />
          ))
        )}
      </PanelSection>
    </>
  );
}

function PermissionModeSelect({
  value,
  onChange,
}: {
  value: PermissionMode;
  onChange: (mode: PermissionMode) => void;
}) {
  const current = PERMISSION_MODES.find((m) => m.value === value);

  return (
    <div>
      <div style={selectLabelStyle}>Permission Mode</div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as PermissionMode)}
        title={current?.description}
        style={selectStyle}
      >
        {PERMISSION_MODES.map((mode) => (
          <option key={mode.value} value={mode.value}>
            {mode.label}
          </option>
        ))}
      </select>
    </div>
  );
}

const selectLabelStyle: React.CSSProperties = {
  fontSize: '10px',
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'var(--text-tertiary)',
  marginBottom: '4px',
};

const selectStyle: React.CSSProperties = {
  width: '100%',
  padding: '4px 6px',
  fontSize: '11px',
  fontFamily: 'var(--font-mono)',
  background: 'var(--bg-elevated)',
  color: 'var(--text-primary)',
  border: 'none',
  borderRadius: 'var(--radius-sm)',
  cursor: 'pointer',
  outline: 'none',
};

interface SessionItemProps {
  name: string;
  status: string;
  permissionMode: PermissionMode;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

function SessionItem({ name, status, permissionMode, isActive, onSelect, onDelete }: SessionItemProps) {
  const [hovered, setHovered] = React.useState(false);

  const modeLabel = PERMISSION_MODES.find((m) => m.value === permissionMode)?.label || permissionMode;

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
      <MessageSquare size={13} style={{ flexShrink: 0, color: 'var(--text-tertiary)' }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={nameStyle}>{name}</span>
        <div style={{ fontSize: '10px', color: 'var(--text-disabled)', marginTop: '1px' }}>
          {modeLabel}
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
          title="Delete session"
        >
          <Trash2 size={12} />
        </button>
      )}
    </div>
  );
}
