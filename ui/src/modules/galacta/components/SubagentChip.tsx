interface SubagentChipProps {
  agentType: string;
  description: string;
  status: 'running' | 'done';
}

export function SubagentChip({ agentType, description, status }: SubagentChipProps) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px',
        borderRadius: 10,
        background: 'var(--bg-hover)',
        border: '1px solid var(--border-subtle)',
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        color: 'var(--text-tertiary)',
      }}
    >
      {status === 'running' && (
        <span style={{ animation: 'galacta-spin 0.8s steps(8) infinite', display: 'inline-block' }}>⠋</span>
      )}
      {status === 'done' && <span>✓</span>}
      <span>{agentType}</span>
      {description && <span style={{ opacity: 0.6 }}>— {description}</span>}
    </span>
  );
}
