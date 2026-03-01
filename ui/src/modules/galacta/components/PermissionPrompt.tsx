import { useState } from 'react';
import { useGalactaStore } from '../stores/galacta-store';

interface PermissionPromptProps {
  sessionId: string;
  requestId: string;
  tool: string;
  input: Record<string, unknown>;
  resolved?: boolean;
  approved?: boolean;
}

export function PermissionPrompt({
  sessionId, requestId, tool, input, resolved, approved,
}: PermissionPromptProps) {
  const respondPermission = useGalactaStore(s => s.respondPermission);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const displayTool = tool.replace(/^galacta_/, '');
  const summary = formatSummary(tool, input);

  if (resolved) {
    return (
      <div
        style={{
          margin: '4px 0',
          padding: '6px 10px',
          borderRadius: 'var(--radius-md)',
          background: 'var(--bg-hover)',
          border: '1px solid var(--border-subtle)',
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: 'var(--text-tertiary)',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <span>{approved ? '✓' : '✗'}</span>
        <span>{displayTool}</span>
        <span style={{ opacity: 0.6 }}>— {approved ? 'allowed' : 'denied'}</span>
      </div>
    );
  }

  return (
    <div
      style={{
        margin: '6px 0',
        padding: 10,
        borderRadius: 'var(--radius-md)',
        background: 'var(--bg-hover)',
        border: '1px solid var(--border-default)',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          color: 'var(--text-secondary)',
          marginBottom: 6,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <span>⚠</span>
        <span style={{ fontWeight: 500 }}>{displayTool}</span>
        <span style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>wants to execute</span>
      </div>

      {summary && (
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--text-secondary)',
            padding: '4px 6px',
            background: 'var(--bg-active)',
            borderRadius: 'var(--radius-sm)',
            marginBottom: 6,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {summary}
        </div>
      )}

      <button
        onClick={() => setDetailsOpen(d => !d)}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--text-tertiary)',
          cursor: 'pointer',
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          padding: 0,
          marginBottom: 6,
        }}
      >
        {detailsOpen ? '▼ hide details' : '▶ show details'}
      </button>

      {detailsOpen && (
        <pre
          style={{
            margin: '0 0 8px',
            padding: 6,
            background: 'var(--bg-active)',
            borderRadius: 'var(--radius-sm)',
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--text-secondary)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            maxHeight: 200,
            overflow: 'auto',
          }}
        >
          {JSON.stringify(input, null, 2)}
        </pre>
      )}

      <div style={{ display: 'flex', gap: 6 }}>
        <button
          onClick={() => respondPermission(sessionId, requestId, true)}
          style={{
            padding: '4px 12px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-default)',
            background: 'var(--bg-active)',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
          }}
        >
          Allow
        </button>
        <button
          onClick={() => respondPermission(sessionId, requestId, false)}
          style={{
            padding: '4px 12px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-default)',
            background: 'var(--bg-hover)',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
          }}
        >
          Deny
        </button>
      </div>
    </div>
  );
}

function formatSummary(_tool: string, input: Record<string, unknown>): string {
  if (input.command) return String(input.command);
  if (input.file_path && input.content) return `write → ${input.file_path}`;
  if (input.file_path && input.old_string) return `edit → ${input.file_path}`;
  if (input.url) return String(input.url);
  return '';
}
