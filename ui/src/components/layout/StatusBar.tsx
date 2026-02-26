import { useConnectionStore } from '../../modules/database/stores/connection-store';

const containerStyle: React.CSSProperties = {
  gridArea: 'statusbar',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 var(--space-3)',
  background: 'var(--bg-base)',
  height: 'var(--statusbar-height)',
  fontSize: '11px',
  fontFamily: 'var(--font-mono)',
  color: 'var(--text-tertiary)',
};

const leftStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-3)',
};

const rightStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-3)',
};

const dotStyle = (connected: boolean): React.CSSProperties => ({
  width: '4px',
  height: '4px',
  borderRadius: '50%',
  background: connected ? 'var(--text-secondary)' : 'var(--text-disabled)',
  display: 'inline-block',
});

export function StatusBar() {
  const activeConnection = useConnectionStore((s) => s.activeConnection);

  return (
    <div style={containerStyle}>
      <div style={leftStyle}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
          <span style={dotStyle(!!activeConnection)} />
          {activeConnection ? activeConnection.name : 'No connection'}
        </span>
        {activeConnection && (
          <span style={{ color: 'var(--text-disabled)' }}>{activeConnection.driver}</span>
        )}
      </div>
      <div style={rightStyle}>
        <span>gnz v0.1.0</span>
      </div>
    </div>
  );
}
