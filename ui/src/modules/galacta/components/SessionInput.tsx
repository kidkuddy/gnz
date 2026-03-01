import { useRef, useCallback } from 'react';

interface SessionInputProps {
  onSend: (text: string) => void;
  onAbort: () => void;
  streaming: boolean;
  disabled: boolean;
}

export function SessionInput({ onSend, onAbort, streaming, disabled }: SessionInputProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      const text = ref.current?.value.trim();
      if (text) {
        onSend(text);
        if (ref.current) ref.current.value = '';
        autoResize();
      }
    }
    if (e.key === 'Escape' && streaming) {
      e.preventDefault();
      onAbort();
    }
  }, [onSend, onAbort, streaming]);

  const autoResize = () => {
    if (!ref.current) return;
    ref.current.style.height = 'auto';
    ref.current.style.height = Math.min(ref.current.scrollHeight, 200) + 'px';
  };

  return (
    <div
      style={{
        padding: '8px 12px',
        borderTop: '1px solid var(--border-subtle)',
        display: 'flex',
        gap: 8,
        alignItems: 'flex-end',
      }}
    >
      <textarea
        ref={ref}
        disabled={disabled}
        placeholder={streaming ? 'Streaming… (Esc to abort)' : 'Message Galacta… (⌘+Enter to send)'}
        onKeyDown={handleKeyDown}
        onInput={autoResize}
        rows={1}
        style={{
          flex: 1,
          resize: 'none',
          background: 'var(--bg-hover)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-md)',
          padding: '8px 10px',
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          outline: 'none',
          lineHeight: 1.5,
          maxHeight: 200,
          opacity: disabled ? 0.5 : 1,
        }}
      />
      {streaming && (
        <button
          onClick={onAbort}
          style={{
            padding: '6px 12px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-default)',
            background: 'var(--bg-hover)',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            whiteSpace: 'nowrap',
          }}
        >
          Abort
        </button>
      )}
    </div>
  );
}
