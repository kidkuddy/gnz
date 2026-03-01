import { useState } from 'react';

interface ThinkingBlockProps {
  text: string;
}

export function ThinkingBlock({ text }: ThinkingBlockProps) {
  const [expanded, setExpanded] = useState(false);
  const preview = text.slice(0, 80).replace(/\n/g, ' ');

  return (
    <div
      style={{
        margin: '4px 0',
        borderLeft: '2px solid var(--border-default)',
        paddingLeft: 8,
      }}
    >
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--text-tertiary)',
          cursor: 'pointer',
          padding: 0,
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <span style={{ fontSize: 9 }}>{expanded ? '▼' : '▶'}</span>
        <span>Thinking</span>
        {!expanded && (
          <span style={{ opacity: 0.5, marginLeft: 4 }}>
            {preview}{text.length > 80 ? '…' : ''}
          </span>
        )}
      </button>
      {expanded && (
        <pre
          style={{
            margin: '4px 0 0',
            padding: 8,
            background: 'var(--bg-hover)',
            borderRadius: 'var(--radius-sm)',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--text-secondary)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            maxHeight: 300,
            overflow: 'auto',
          }}
        >
          {text}
        </pre>
      )}
    </div>
  );
}
