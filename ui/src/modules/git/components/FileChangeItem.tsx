import React from 'react';
import { Plus, Minus, Trash2 } from 'lucide-react';

interface FileChangeItemProps {
  path: string;
  status: string;
  staged: boolean;
  onStage: () => void;
  onUnstage: () => void;
  onDiscard: () => void;
  onClick?: () => void;
}

const statusColors: Record<string, string> = {
  M: '#e2b714',
  A: '#2dd4bf',
  D: '#ef4444',
  R: '#60a5fa',
  '?': '#6b7280',
};

export function FileChangeItem({
  path,
  status,
  staged,
  onStage,
  onUnstage,
  onDiscard,
  onClick,
}: FileChangeItemProps) {
  const [hovered, setHovered] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);

  const fileName = path.split('/').pop() || path;
  const dir = path.includes('/') ? path.substring(0, path.lastIndexOf('/')) : '';
  const color = statusColors[status] || 'var(--text-tertiary)';

  const handleDiscard = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirming) {
      onDiscard();
      setConfirming(false);
    } else {
      setConfirming(true);
      setTimeout(() => setConfirming(false), 3000);
    }
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (staged) {
      onUnstage();
    } else {
      onStage();
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-1)',
        padding: '2px var(--space-3)',
        cursor: onClick ? 'pointer' : 'default',
        background: hovered ? 'var(--bg-hover)' : 'transparent',
        transition: 'background 80ms ease',
      }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        setConfirming(false);
      }}
    >
      <span
        style={{
          width: '14px',
          textAlign: 'center',
          fontSize: '11px',
          fontWeight: 600,
          fontFamily: 'var(--font-mono)',
          color,
          flexShrink: 0,
        }}
      >
        {status}
      </span>
      <span
        style={{
          flex: 1,
          fontSize: '12px',
          color: 'var(--text-secondary)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        title={path}
      >
        {fileName}
        {dir && (
          <span style={{ color: 'var(--text-disabled)', marginLeft: '4px', fontSize: '10px' }}>
            {dir}
          </span>
        )}
      </span>
      {hovered && (
        <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
          <button
            onClick={handleToggle}
            style={{
              display: 'flex',
              alignItems: 'center',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-tertiary)',
              padding: '2px',
            }}
            title={staged ? 'Unstage' : 'Stage'}
          >
            {staged ? <Minus size={12} /> : <Plus size={12} />}
          </button>
          {!staged && (
            <button
              onClick={handleDiscard}
              style={{
                display: 'flex',
                alignItems: 'center',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: confirming ? 'var(--status-error)' : 'var(--text-tertiary)',
                padding: '2px',
              }}
              title={confirming ? 'Click again to discard' : 'Discard changes'}
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
