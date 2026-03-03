import type { KanbanCard } from '../../../lib/tauri-ipc';

const priorityConfig: Record<KanbanCard['priority'], { bg: string; color: string }> = {
  must:   { bg: 'rgba(255,255,255,0.12)', color: 'var(--text-primary)' },
  should: { bg: 'rgba(255,255,255,0.07)', color: 'var(--text-secondary)' },
  could:  { bg: 'rgba(255,255,255,0.04)', color: 'var(--text-tertiary)' },
  would:  { bg: 'transparent',            color: 'var(--text-disabled)' },
};

interface PriorityBadgeProps {
  priority: KanbanCard['priority'];
}

export function PriorityBadge({ priority }: PriorityBadgeProps) {
  const { bg, color } = priorityConfig[priority] ?? priorityConfig.could;
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '1px 5px',
        borderRadius: 'var(--radius-sm)',
        background: bg,
        border: '1px solid rgba(255,255,255,0.08)',
        color,
        fontSize: '10px',
        fontFamily: 'var(--font-mono)',
        fontWeight: 500,
        lineHeight: '16px',
        letterSpacing: '0.04em',
        flexShrink: 0,
      }}
    >
      {priority}
    </span>
  );
}
