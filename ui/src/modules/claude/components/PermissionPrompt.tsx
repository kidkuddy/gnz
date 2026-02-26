import React from 'react';
import { Check, X, ShieldQuestion } from 'lucide-react';

interface PermissionPromptProps {
  requestId: string;
  toolName: string;
  input?: Record<string, unknown>;
  description?: string;
  resolved: boolean;
  decision?: 'allow' | 'deny';
  onRespond: (requestId: string, behavior: 'allow' | 'deny', input?: Record<string, unknown>) => void;
}

export function PermissionPrompt({
  requestId,
  toolName,
  input,
  description,
  resolved,
  decision,
  onRespond,
}: PermissionPromptProps) {
  const [expanded, setExpanded] = React.useState(false);

  if (resolved) {
    return (
      <div style={resolvedStyle}>
        {decision === 'allow' ? (
          <Check size={11} style={{ color: 'var(--text-disabled)', flexShrink: 0 }} />
        ) : (
          <X size={11} style={{ color: 'var(--text-disabled)', flexShrink: 0 }} />
        )}
        <span style={{ color: 'var(--text-disabled)' }}>
          {toolName} — {decision === 'allow' ? 'allowed' : 'denied'}
        </span>
      </div>
    );
  }

  const summary = getSummary(toolName, input);

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <ShieldQuestion size={13} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={toolLabelStyle}>{toolName}</div>
          {summary && <div style={summaryStyle}>{summary}</div>}
          {description && !summary && <div style={summaryStyle}>{description}</div>}
        </div>
      </div>

      {input && (
        <div
          style={detailToggleStyle}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? 'hide details' : 'show details'}
        </div>
      )}

      {expanded && input && (
        <pre style={inputPreStyle}>
          {JSON.stringify(input, null, 2)}
        </pre>
      )}

      <div style={actionsStyle}>
        <button
          style={allowBtnStyle}
          onClick={() => onRespond(requestId, 'allow', input)}
        >
          Allow
        </button>
        <button
          style={denyBtnStyle}
          onClick={() => onRespond(requestId, 'deny')}
        >
          Deny
        </button>
      </div>
    </div>
  );
}

function getSummary(tool: string, input?: Record<string, unknown>): string {
  if (!input) return '';
  if (tool === 'Bash' && input.command) return String(input.command).slice(0, 120);
  if (input.file_path) return String(input.file_path);
  if (input.pattern) return String(input.pattern);
  if (input.command) return String(input.command).slice(0, 120);
  return '';
}

const containerStyle: React.CSSProperties = {
  margin: '6px 0',
  padding: '8px 10px',
  background: 'rgba(255, 200, 50, 0.04)',
  border: '1px solid rgba(255, 200, 50, 0.12)',
  borderRadius: 'var(--radius-sm)',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: '8px',
};

const toolLabelStyle: React.CSSProperties = {
  fontSize: '12px',
  fontFamily: 'var(--font-mono)',
  fontWeight: 500,
  color: 'var(--text-primary)',
};

const summaryStyle: React.CSSProperties = {
  fontSize: '11px',
  fontFamily: 'var(--font-mono)',
  color: 'var(--text-tertiary)',
  marginTop: '2px',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const detailToggleStyle: React.CSSProperties = {
  fontSize: '10px',
  fontFamily: 'var(--font-mono)',
  color: 'var(--text-disabled)',
  cursor: 'pointer',
  marginTop: '4px',
  userSelect: 'none',
};

const inputPreStyle: React.CSSProperties = {
  margin: '4px 0 0 0',
  padding: '6px 8px',
  background: 'var(--bg-elevated)',
  borderRadius: 'var(--radius-sm)',
  fontSize: '11px',
  fontFamily: 'var(--font-mono)',
  color: 'var(--text-secondary)',
  overflow: 'auto',
  maxHeight: '150px',
};

const actionsStyle: React.CSSProperties = {
  display: 'flex',
  gap: '6px',
  marginTop: '8px',
};

const allowBtnStyle: React.CSSProperties = {
  padding: '3px 14px',
  background: 'var(--text-primary)',
  border: 'none',
  borderRadius: 'var(--radius-sm)',
  fontSize: '11px',
  fontFamily: 'var(--font-mono)',
  fontWeight: 500,
  color: '#000',
  cursor: 'pointer',
};

const denyBtnStyle: React.CSSProperties = {
  padding: '3px 14px',
  background: 'transparent',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  fontSize: '11px',
  fontFamily: 'var(--font-mono)',
  fontWeight: 500,
  color: 'var(--text-secondary)',
  cursor: 'pointer',
};

const resolvedStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  margin: '4px 0',
  fontSize: '11.5px',
  fontFamily: 'var(--font-mono)',
  opacity: 0.6,
};
