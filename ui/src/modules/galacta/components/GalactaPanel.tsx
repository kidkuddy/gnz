import { useEffect, useState } from 'react';
import { useGalactaStore, type GalactaSession, type ExternalSession } from '../stores/galacta-store';
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
  const discoverSessions = useGalactaStore(s => s.discoverSessions);
  const importSession = useGalactaStore(s => s.importSession);

  const activeWorkspace = useWorkspaceStore(s => s.activeWorkspace);
  const addTab = useTabStore(s => s.addTab);

  const [discoverOpen, setDiscoverOpen] = useState(false);
  const [externalSessions, setExternalSessions] = useState<ExternalSession[]>([]);
  const [discovering, setDiscovering] = useState(false);
  const [importing, setImporting] = useState<string | null>(null);

  // Check status on mount + poll every 10s
  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  // Load sessions from gnz DB when online + workspace available
  useEffect(() => {
    if (galactaStatus === 'online' && activeWorkspace) {
      loadSessions(activeWorkspace.id);
    }
  }, [galactaStatus, activeWorkspace?.id]);

  // Close discover panel when workspace changes
  useEffect(() => {
    setDiscoverOpen(false);
    setExternalSessions([]);
  }, [activeWorkspace?.id]);

  const workingDir = () => {
    if (!activeWorkspace) return '/tmp';
    return parseWorkspaceSettings(activeWorkspace.settings).working_directory || '/tmp';
  };

  const handleNewSession = async () => {
    if (!activeWorkspace) return;
    const session = await createSession(activeWorkspace.id, workingDir());
    if (session) {
      openSessionTab(session);
    }
  };

  const handleToggleDiscover = async () => {
    if (discoverOpen) {
      setDiscoverOpen(false);
      setExternalSessions([]);
      return;
    }
    if (!activeWorkspace) return;
    setDiscoverOpen(true);
    setDiscovering(true);
    const found = await discoverSessions(activeWorkspace.id, workingDir());
    setExternalSessions(found);
    setDiscovering(false);
  };

  const handleImport = async (ext: ExternalSession) => {
    if (!activeWorkspace) return;
    setImporting(ext.id);
    const session = await importSession(activeWorkspace.id, ext.id);
    setImporting(null);
    if (session) {
      setExternalSessions(prev => prev.filter(s => s.id !== ext.id));
      openSessionTab(session);
    }
  };

  const openSessionTab = (session: GalactaSession) => {
    setActiveSession(session.id);
    addTab({
      id: `galacta-${session.id}`,
      title: session.name,
      type: 'galacta-session',
      moduleId: 'galacta',
      data: { sessionId: session.id, workspaceId: session.workspace_id },
    });
  };

  const handleDeleteSession = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!activeWorkspace) return;
    await deleteSession(activeWorkspace.id, id);
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              onClick={handleToggleDiscover}
              title="Discover existing sessions"
              style={{
                background: discoverOpen ? 'var(--bg-active)' : 'none',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-sm)',
                padding: '2px 6px',
                color: discoverOpen ? 'var(--accent)' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
              }}
            >
              discover
            </button>
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
          </div>
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

          {/* Discover panel */}
          {discoverOpen && (
            <div style={{
              borderBottom: '1px solid var(--border-subtle)',
              paddingBottom: 4,
              marginBottom: 4,
            }}>
              <div style={{
                padding: '4px 12px 6px',
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                color: 'var(--text-tertiary)',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}>
                External sessions
              </div>

              {discovering && (
                <div style={{
                  padding: '6px 12px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  color: 'var(--text-tertiary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}>
                  <span style={{ animation: 'galacta-spin 0.8s steps(8) infinite' }}>⠋</span>
                  Scanning…
                </div>
              )}

              {!discovering && externalSessions.length === 0 && (
                <div style={{
                  padding: '6px 12px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  color: 'var(--text-tertiary)',
                }}>
                  No untracked sessions found
                </div>
              )}

              {!discovering && externalSessions.map(ext => (
                <ExternalSessionItem
                  key={ext.id}
                  session={ext}
                  importing={importing === ext.id}
                  onImport={() => handleImport(ext)}
                />
              ))}
            </div>
          )}

          {/* Tracked sessions */}
          {sessions.length === 0 && !discoverOpen && (
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

// ── External session item (discover) ─────────────────────────────────

function ExternalSessionItem({
  session,
  importing,
  onImport,
}: {
  session: ExternalSession;
  importing: boolean;
  onImport: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const dirLabel = session.working_dir.split('/').pop() || session.working_dir;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '6px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        background: hovered ? 'var(--bg-hover)' : 'transparent',
      }}
    >
      <span style={{
        width: 4,
        height: 4,
        borderRadius: '50%',
        background: 'var(--text-disabled)',
        flexShrink: 0,
      }} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: 'var(--text-secondary)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {dirLabel}
        </div>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          color: 'var(--text-tertiary)',
          marginTop: 1,
        }}>
          {session.id.slice(0, 8)}… · {(session.model || '').replace('claude-', '')}
        </div>
      </div>

      <button
        onClick={onImport}
        disabled={importing}
        style={{
          background: 'none',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-sm)',
          padding: '1px 6px',
          color: importing ? 'var(--text-disabled)' : 'var(--accent)',
          cursor: importing ? 'default' : 'pointer',
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          flexShrink: 0,
        }}
      >
        {importing ? '…' : 'import'}
      </button>
    </div>
  );
}

// ── Session item ──────────────────────────────────────────────────────

function SessionItem({
  session,
  isActive,
  onSelect,
  onDelete,
}: {
  session: GalactaSession;
  isActive: boolean;
  onSelect: () => void;
  onDelete: (e: React.MouseEvent) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const dirName = session.name;

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
