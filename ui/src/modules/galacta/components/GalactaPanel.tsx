import { useEffect, useState } from 'react';
import { useGalactaStore, type GalactaSession } from '../stores/galacta-store';
import { useWorkspaceStore } from '../../../stores/workspace-store';
import { useTabStore } from '../../../stores/tab-store';
import { parseWorkspaceSettings } from '../../../lib/tauri-ipc';

export function GalactaPanel() {
  const galactaStatus = useGalactaStore(s => s.galactaStatus);
  const sessions = useGalactaStore(s => s.sessions);
  const activeSessionId = useGalactaStore(s => s.activeSessionId);
  const checkStatus = useGalactaStore(s => s.checkStatus);
  const launchGalacta = useGalactaStore(s => s.launchGalacta);
  const loadSessions = useGalactaStore(s => s.loadSessions);
  const createSession = useGalactaStore(s => s.createSession);
  const deleteSession = useGalactaStore(s => s.deleteSession);
  const setActiveSession = useGalactaStore(s => s.setActiveSession);

  const sessionNames = useGalactaStore(s => s.sessionNames);

  const activeWorkspace = useWorkspaceStore(s => s.activeWorkspace);
  const addTab = useTabStore(s => s.addTab);

  // Check status on mount + poll every 10s
  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  // Resolve workspace working dir
  const workspaceDir = activeWorkspace
    ? parseWorkspaceSettings(activeWorkspace.settings).working_directory
    : undefined;

  // Load sessions filtered by workspace dir when online
  useEffect(() => {
    if (galactaStatus === 'online') loadSessions(workspaceDir);
  }, [galactaStatus, workspaceDir]);

  const handleNewSession = async () => {
    if (!activeWorkspace) return;
    const settings = parseWorkspaceSettings(activeWorkspace.settings);
    const workingDir = settings.working_directory || '/tmp';
    const session = await createSession(workingDir);
    if (session) {
      openSessionTab(session);
    }
  };

  const openSessionTab = (session: GalactaSession) => {
    setActiveSession(session.id);
    addTab({
      id: `galacta-${session.id}`,
      title: sessionNames[session.id] || session.working_dir.split('/').pop() || 'session',
      type: 'galacta-session',
      moduleId: 'galacta',
      data: { sessionId: session.id },
    });
  };

  const handleDeleteSession = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await deleteSession(id);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div
        style={{
          padding: '8px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <StatusDot status={galactaStatus} />
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--text-secondary)',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}>
            Galacta
          </span>
        </div>

        {galactaStatus === 'online' && (
          <button
            onClick={handleNewSession}
            style={{
              background: 'none',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-sm)',
              padding: '2px 8px',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
            }}
          >
            + new
          </button>
        )}
      </div>

      {/* Offline / launching state */}
      {galactaStatus === 'offline' && (
        <div style={{
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
        }}>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--text-tertiary)',
          }}>
            Galacta is offline
          </span>
          <button
            onClick={launchGalacta}
            style={{
              padding: '6px 16px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-default)',
              background: 'var(--bg-hover)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
            }}
          >
            Launch
          </button>
        </div>
      )}

      {galactaStatus === 'launching' && (
        <div style={{
          padding: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: 'var(--text-tertiary)',
        }}>
          <span style={{ animation: 'galacta-spin 0.8s steps(8) infinite' }}>⠋</span>
          Connecting…
        </div>
      )}

      {/* Session list */}
      {galactaStatus === 'online' && (
        <div style={{ flex: 1, overflow: 'auto', padding: '4px 0' }}>
          {sessions.length === 0 && (
            <div style={{
              padding: '16px 12px',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--text-tertiary)',
              textAlign: 'center',
            }}>
              No sessions
            </div>
          )}

          {sessions.map(session => (
            <SessionItem
              key={session.id}
              session={session}
              displayName={sessionNames[session.id]}
              isActive={session.id === activeSessionId}
              onSelect={() => openSessionTab(session)}
              onDelete={(e) => handleDeleteSession(e, session.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Status dot ────────────────────────────────────────────────────────

function StatusDot({ status }: { status: string }) {
  const color =
    status === 'online' ? '#4a4' :
    status === 'launching' ? '#d4a017' :
    '#644';

  return (
    <span
      style={{
        display: 'inline-block',
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: color,
        boxShadow: status === 'online' ? `0 0 4px ${color}` : 'none',
      }}
    />
  );
}

// ── Session item ──────────────────────────────────────────────────────

function SessionItem({
  session,
  displayName,
  isActive,
  onSelect,
  onDelete,
}: {
  session: GalactaSession;
  displayName?: string;
  isActive: boolean;
  onSelect: () => void;
  onDelete: (e: React.MouseEvent) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const dirName = displayName || session.working_dir.split('/').pop() || session.id.slice(0, 8);

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '6px 12px',
        cursor: 'pointer',
        background: isActive ? 'var(--bg-active)' : hovered ? 'var(--bg-hover)' : 'transparent',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      {/* Status indicator */}
      <span
        style={{
          width: 4,
          height: 4,
          borderRadius: '50%',
          background:
            session.status === 'running' ? '#2dd4bf' :
            session.status === 'error' ? '#c44' :
            'var(--text-disabled)',
          flexShrink: 0,
        }}
      />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: 'var(--text-primary)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {dirName}
        </div>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          color: 'var(--text-tertiary)',
          marginTop: 1,
        }}>
          {(session.model || '').replace('claude-', '')}
        </div>
      </div>

      {hovered && (
        <button
          onClick={onDelete}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-tertiary)',
            cursor: 'pointer',
            padding: '0 2px',
            fontSize: 12,
            lineHeight: 1,
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}
