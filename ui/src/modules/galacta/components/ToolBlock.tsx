import { useState } from 'react';

interface ToolBlockProps {
  tool: string;
  callId: string;
  input: Record<string, unknown>;
  output?: string;
  isError?: boolean;
  durationMs?: number;
  status: 'running' | 'done' | 'error';
}

export function ToolBlock({ tool, input, output, isError, durationMs, status }: ToolBlockProps) {
  const [expanded, setExpanded] = useState(false);

  const displayName = tool.replace(/^galacta_/, '');
  const durationStr = durationMs != null ? `${(durationMs / 1000).toFixed(1)}s` : null;
  const inputSummary = formatInputSummary(tool, input);
  const hasDetails = output != null || Object.keys(input).length > 0;

  return (
    <div
      style={{
        margin: '4px 0',
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
      }}
    >
      {/* Header — clickable to expand */}
      <div
        onClick={hasDetails ? () => setExpanded(e => !e) : undefined}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          color: 'var(--text-secondary)',
          cursor: hasDetails ? 'pointer' : 'default',
          userSelect: 'none',
        }}
      >
        {status === 'running' && <Spinner />}
        {status !== 'running' && (
          <span style={{ fontSize: 9, color: 'var(--text-tertiary)', width: 10, textAlign: 'center' }}>
            {expanded ? '▼' : '▶'}
          </span>
        )}
        <span style={{ color: 'var(--text-secondary)' }}>{displayName}</span>
        {inputSummary && (
          <span style={{
            color: 'var(--text-tertiary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: 400,
          }}>
            {inputSummary}
          </span>
        )}
        {durationStr && <span style={{ color: 'var(--text-tertiary)', fontSize: 10 }}>{durationStr}</span>}
        {isError && <span style={{ color: 'var(--text-tertiary)', fontSize: 10 }}>error</span>}
      </div>

      {/* Expanded details */}
      {expanded && (
        <div
          style={{
            marginTop: 4,
            marginLeft: 16,
            padding: 8,
            background: 'var(--bg-hover)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          {/* Input */}
          {Object.keys(input).length > 0 && (
            <div style={{ marginBottom: output != null ? 8 : 0 }}>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                input
              </div>
              <pre style={{
                margin: 0,
                fontSize: 11,
                color: 'var(--text-secondary)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}>
                {JSON.stringify(input, null, 2)}
              </pre>
            </div>
          )}

          {/* Output */}
          {output != null && (
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                output
              </div>
              <pre style={{
                margin: 0,
                fontSize: 11,
                color: 'var(--text-secondary)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                maxHeight: 400,
                overflow: 'auto',
              }}>
                {String(output)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <span
      style={{
        display: 'inline-block',
        width: 10,
        textAlign: 'center',
        color: 'var(--text-tertiary)',
        animation: 'galacta-spin 0.8s steps(8) infinite',
      }}
    >
      ⠋
    </span>
  );
}

function formatInputSummary(_tool: string, input: Record<string, unknown>): string {
  if (input.command) return String(input.command).slice(0, 120);
  if (input.file_path) return String(input.file_path);
  if (input.pattern) return `${String(input.pattern)}${input.path ? ` in ${String(input.path)}` : ''}`;
  if (input.query) return String(input.query).slice(0, 120);
  if (input.url) return String(input.url).slice(0, 120);
  if (input.old_string) return `edit ${String(input.file_path || '')}`;
  if (input.content && input.file_path) return `write ${String(input.file_path)}`;

  for (const [k, v] of Object.entries(input)) {
    if (typeof v === 'string' && v.length > 0) return `${k}: ${v.slice(0, 80)}`;
  }
  return '';
}
