import React from 'react';
import { Play, Pencil, Trash2, Square, Loader } from 'lucide-react';
import type { Action } from '../../../lib/tauri-ipc';

interface ActionItemProps {
  action: Action;
  runStatus: 'idle' | 'running' | 'completed' | 'failed';
  onRun: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onKill: () => void;
}

export function ActionItem({ action, runStatus, onRun, onEdit, onDelete, onKill }: ActionItemProps) {
  const [hovered, setHovered] = React.useState(false);

  const statusColor =
    runStatus === 'running'
      ? 'var(--accent)'
      : runStatus === 'completed'
        ? 'var(--status-success, #22c55e)'
        : runStatus === 'failed'
          ? 'var(--status-error, #ef4444)'
          : 'var(--text-disabled)';

  const itemStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-2)',
    padding: 'var(--space-2) var(--space-3)',
    cursor: 'pointer',
    background: hovered ? 'var(--bg-hover)' : 'transparent',
    transition: 'background 80ms ease',
  };

  const handleClick = () => {
    if (runStatus === 'running') return;
    onRun();
  };

  return (
    <div
      style={itemStyle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={handleClick}
    >
      {runStatus === 'running' ? (
        <Loader size={13} style={{ flexShrink: 0, color: 'var(--accent)', animation: 'spin 1s linear infinite' }} />
      ) : (
        <Play size={13} style={{ flexShrink: 0, color: 'var(--text-tertiary)' }} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: '12px',
            color: 'var(--text-secondary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {action.name}
        </div>
        <div
          style={{
            fontSize: '10px',
            color: 'var(--text-disabled)',
            fontFamily: 'var(--font-mono)',
            marginTop: '1px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {action.command}
        </div>
      </div>
      <span
        style={{
          width: '5px',
          height: '5px',
          borderRadius: '50%',
          background: statusColor,
          flexShrink: 0,
          boxShadow: runStatus === 'running' ? `0 0 4px ${statusColor}` : 'none',
        }}
        title={runStatus}
      />
      {hovered && runStatus === 'running' && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onKill();
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--status-error, #ef4444)',
            padding: 0,
          }}
          title="Kill run"
        >
          <Square size={12} />
        </button>
      )}
      {hovered && runStatus !== 'running' && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
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
            title="Edit action"
          >
            <Pencil size={12} />
          </button>
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
            title="Delete action"
          >
            <Trash2 size={12} />
          </button>
        </>
      )}
    </div>
  );
}
