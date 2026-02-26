import React from 'react';
import { Send, Square } from 'lucide-react';

interface SessionInputProps {
  onSend: (text: string) => void;
  onAbort: () => void;
  isStreaming: boolean;
}

export function SessionInput({ onSend, onAbort, isStreaming }: SessionInputProps) {
  const [text, setText] = React.useState('');
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;
    onSend(trimmed);
    setText('');
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape' && isStreaming) {
      e.preventDefault();
      onAbort();
    }
  };

  // Auto-resize textarea
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    const target = e.target;
    target.style.height = 'auto';
    target.style.height = Math.min(target.scrollHeight, 200) + 'px';
  };

  return (
    <div style={containerStyle}>
      <div style={inputWrapperStyle}>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder="Message... (Cmd+Enter to send)"
          rows={1}
          style={textareaStyle}
          disabled={isStreaming}
        />
        <div style={actionsStyle}>
          {isStreaming ? (
            <button onClick={onAbort} style={abortBtnStyle} title="Stop (Escape)">
              <Square size={14} />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!text.trim()}
              style={{
                ...sendBtnStyle,
                opacity: text.trim() ? 1 : 0.3,
              }}
              title="Send (Cmd+Enter)"
            >
              <Send size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  padding: 'var(--space-3)',
  borderTop: '1px solid var(--border-subtle)',
  background: 'var(--bg-surface)',
};

const inputWrapperStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-end',
  gap: 'var(--space-2)',
  background: 'var(--bg-base)',
  borderRadius: 'var(--radius-lg)',
  border: '1px solid var(--border-default)',
  padding: 'var(--space-2) var(--space-3)',
};

const textareaStyle: React.CSSProperties = {
  flex: 1,
  background: 'none',
  border: 'none',
  outline: 'none',
  resize: 'none',
  color: 'var(--text-primary)',
  fontFamily: 'var(--font-mono)',
  fontSize: '13px',
  lineHeight: '1.5',
  maxHeight: '200px',
};

const actionsStyle: React.CSSProperties = {
  display: 'flex',
  gap: 'var(--space-1)',
  flexShrink: 0,
  paddingBottom: '2px',
};

const sendBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '28px',
  height: '28px',
  borderRadius: 'var(--radius-md)',
  background: 'var(--accent)',
  color: '#0a0a0b',
  border: 'none',
  cursor: 'pointer',
};

const abortBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '28px',
  height: '28px',
  borderRadius: 'var(--radius-md)',
  background: 'var(--status-error)',
  color: '#fff',
  border: 'none',
  cursor: 'pointer',
};
