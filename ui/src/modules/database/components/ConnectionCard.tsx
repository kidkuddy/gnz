import React from 'react';
import { Database, Trash2 } from 'lucide-react';
import { Badge } from '../../../components/ui/Badge';
import type { Connection } from '../../../lib/tauri-ipc';

interface ConnectionCardProps {
  connection: Connection;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

const driverIcons: Record<string, string> = {
  postgres: 'PG',
  mysql: 'MY',
  sqlite: 'SQ',
  clickhouse: 'CH',
};

export function ConnectionCard({ connection, isActive, onSelect, onDelete }: ConnectionCardProps) {
  const [hovered, setHovered] = React.useState(false);

  const cardStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-2)',
    padding: 'var(--space-2) var(--space-3)',
    cursor: 'pointer',
    background: isActive ? 'var(--accent-muted)' : hovered ? 'var(--bg-hover)' : 'transparent',
    borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
    transition: 'all 80ms ease',
  };

  const iconStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '28px',
    height: '28px',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--bg-elevated)',
    color: isActive ? 'var(--accent-text)' : 'var(--text-tertiary)',
    flexShrink: 0,
  };

  const infoStyle: React.CSSProperties = {
    flex: 1,
    minWidth: 0,
  };

  const nameStyle: React.CSSProperties = {
    fontSize: '12px',
    fontWeight: 500,
    color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  };

  const deleteBtnStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '20px',
    height: '20px',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-disabled)',
    opacity: hovered ? 1 : 0,
    transition: 'opacity 80ms ease',
    flexShrink: 0,
  };

  return (
    <div
      style={cardStyle}
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={iconStyle}>
        {driverIcons[connection.driver] ? (
          <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
            {driverIcons[connection.driver]}
          </span>
        ) : (
          <Database size={14} />
        )}
      </div>
      <div style={infoStyle}>
        <div style={nameStyle}>{connection.name}</div>
      </div>
      <Badge variant="default">{connection.driver}</Badge>
      <button
        style={deleteBtnStyle}
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        title="Delete connection"
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
}
