import { useWorkspaceStore } from '../../stores/workspace-store';

const containerStyle: React.CSSProperties = {
  gridArea: 'titlebar',
  display: 'flex',
  alignItems: 'center',
  padding: '0 var(--space-4)',
  background: 'var(--bg-surface)',
  borderBottom: '1px solid var(--border-subtle)',
  height: 'var(--titlebar-height)',
  // @ts-expect-error WebkitAppRegion is a non-standard CSS property for Tauri drag regions
  WebkitAppRegion: 'drag',
  userSelect: 'none',
  gap: 'var(--space-3)',
};

const logoStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontWeight: 700,
  fontSize: '13px',
  color: 'var(--accent-text)',
  letterSpacing: '-0.02em',
};

const separatorStyle: React.CSSProperties = {
  width: '1px',
  height: '14px',
  background: 'var(--border-default)',
};

const workspaceNameStyle: React.CSSProperties = {
  fontSize: '12px',
  color: 'var(--text-secondary)',
  fontWeight: 500,
};

export function TitleBar() {
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace);

  return (
    <div style={containerStyle}>
      <span style={logoStyle}>gnz</span>
      {activeWorkspace && (
        <>
          <span style={separatorStyle} />
          <span style={workspaceNameStyle}>{activeWorkspace.name}</span>
        </>
      )}
    </div>
  );
}
