import { Database, Terminal, FolderOpen } from 'lucide-react';
import { Badge } from '../components/ui/Badge';
import { useWorkspaceStore } from '../stores/workspace-store';
import { useConnectionStore } from '../modules/database/stores/connection-store';

const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  padding: 'var(--space-8)',
  gap: 'var(--space-6)',
};

const headerStyle: React.CSSProperties = {
  textAlign: 'center',
};

const titleStyle: React.CSSProperties = {
  fontSize: '20px',
  fontWeight: 600,
  color: 'var(--text-primary)',
  marginBottom: 'var(--space-1)',
};

const subtitleStyle: React.CSSProperties = {
  fontSize: '13px',
  color: 'var(--text-tertiary)',
};

const statsGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: 'var(--space-4)',
  maxWidth: '480px',
  width: '100%',
};

const statCardStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 'var(--space-2)',
  padding: 'var(--space-5)',
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-lg)',
};

const statValueStyle: React.CSSProperties = {
  fontSize: '24px',
  fontWeight: 700,
  fontFamily: 'var(--font-mono)',
  color: 'var(--text-primary)',
};

const statLabelStyle: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--text-tertiary)',
};

export function WorkspaceDashboardView() {
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace);
  const connections = useConnectionStore((s) => s.connections);

  if (!activeWorkspace) return null;

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <div style={titleStyle}>
          <FolderOpen
            size={20}
            color="var(--accent-text)"
            style={{ verticalAlign: 'middle', marginRight: 'var(--space-2)' }}
          />
          {activeWorkspace.name}
        </div>
        {activeWorkspace.description && (
          <div style={subtitleStyle}>{activeWorkspace.description}</div>
        )}
      </div>

      <div style={statsGridStyle}>
        <div style={statCardStyle}>
          <Database size={20} color="var(--accent-text)" />
          <div style={statValueStyle}>{connections.length}</div>
          <div style={statLabelStyle}>Connections</div>
        </div>
        <div style={statCardStyle}>
          <Terminal size={20} color="var(--accent-text)" />
          <div style={statValueStyle}>0</div>
          <div style={statLabelStyle}>Queries</div>
        </div>
        <div style={statCardStyle}>
          <Badge variant="accent" style={{ fontSize: '13px', padding: '2px 10px' }}>
            Active
          </Badge>
          <div style={statLabelStyle}>Status</div>
        </div>
      </div>
    </div>
  );
}
