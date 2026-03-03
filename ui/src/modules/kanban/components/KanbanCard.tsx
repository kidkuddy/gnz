import React from 'react';
import type { KanbanCard as KanbanCardType } from '../../../lib/tauri-ipc';
import { PriorityBadge } from './PriorityBadge';

interface KanbanCardProps {
  card: KanbanCardType;
  onClick: () => void;
}

const MAX_LABELS = 3;

export function KanbanCard({ card, onClick }: KanbanCardProps) {
  const [hovered, setHovered] = React.useState(false);
  // Track whether a drag actually started so we don't fire onClick on drag-end
  const dragging = React.useRef(false);

  const visibleLabels = card.labels.slice(0, MAX_LABELS);
  const extraLabels = card.labels.length - MAX_LABELS;

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    dragging.current = true;
    e.dataTransfer.setData('text/plain', card.id); // use text/plain for broader compatibility
    e.dataTransfer.setData('cardId', card.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    // Small delay so the click event (which fires after dragend) gets suppressed
    setTimeout(() => { dragging.current = false; }, 50);
  };

  const handleClick = () => {
    if (!dragging.current) onClick();
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? 'var(--bg-hover)' : 'var(--bg-elevated)',
        border: `1px solid ${hovered ? 'var(--border-strong)' : 'var(--border-default)'}`,
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-2) var(--space-3)',
        cursor: 'grab',
        userSelect: 'none',
        transition: 'background 80ms ease, border-color 80ms ease',
      }}
    >
      {/* Title */}
      <div
        style={{
          fontSize: '13px',
          color: 'var(--text-primary)',
          lineHeight: 1.4,
          wordBreak: 'break-word',
        }}
      >
        {card.title}
      </div>

      {/* Footer: priority + labels in a single row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', flexWrap: 'wrap', marginTop: 'var(--space-2)' }}>
        <PriorityBadge priority={card.priority} />

        {visibleLabels.map((label) => (
          <span
            key={label.id}
            style={{
              display: 'inline-block',
              padding: '1px 5px',
              borderRadius: 'var(--radius-sm)',
              background: 'transparent',
              border: '1px solid var(--border-subtle)',
              fontSize: '10px',
              color: 'var(--text-disabled)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {label.name}
          </span>
        ))}

        {extraLabels > 0 && (
          <span style={{ fontSize: '10px', color: 'var(--text-disabled)', fontFamily: 'var(--font-mono)' }}>
            +{extraLabels}
          </span>
        )}
      </div>
    </div>
  );
}
