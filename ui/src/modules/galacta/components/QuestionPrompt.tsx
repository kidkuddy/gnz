import { useState } from 'react';
import { useGalactaStore } from '../stores/galacta-store';

interface QuestionPromptProps {
  sessionId: string;
  requestId: string;
  question: string;
  header?: string;
  options: { label: string; description?: string }[];
  resolved?: boolean;
  answer?: string;
}

export function QuestionPrompt({
  sessionId, requestId, question, header, options, resolved, answer,
}: QuestionPromptProps) {
  const respondQuestion = useGalactaStore(s => s.respondQuestion);
  const [customText, setCustomText] = useState('');

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
        <span>✓</span>
        <span>{question}</span>
        <span style={{ opacity: 0.6 }}>→ {answer}</span>
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
      {header && (
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--text-tertiary)',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            marginBottom: 4,
          }}
        >
          {header}
        </div>
      )}
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          color: 'var(--text-primary)',
          marginBottom: 8,
        }}
      >
        {question}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {options.map((opt, i) => (
          <button
            key={i}
            onClick={() => respondQuestion(sessionId, requestId, String(i + 1))}
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 8,
              padding: '6px 10px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-default)',
              background: 'var(--bg-active)',
              cursor: 'pointer',
              textAlign: 'left',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--text-secondary)',
            }}
          >
            <span style={{ color: 'var(--text-tertiary)', minWidth: 16 }}>{i + 1}.</span>
            <span>
              <span style={{ color: 'var(--text-primary)' }}>{opt.label}</span>
              {opt.description && (
                <span style={{ color: 'var(--text-tertiary)', marginLeft: 6 }}>
                  {opt.description}
                </span>
              )}
            </span>
          </button>
        ))}

        {/* Free-text fallback */}
        <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
          <input
            value={customText}
            onChange={e => setCustomText(e.target.value)}
            placeholder="Other…"
            onKeyDown={e => {
              if (e.key === 'Enter' && customText.trim()) {
                respondQuestion(sessionId, requestId, customText.trim());
              }
            }}
            style={{
              flex: 1,
              padding: '4px 8px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-default)',
              background: 'var(--bg-elevated)',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              outline: 'none',
            }}
          />
          <button
            onClick={() => {
              if (customText.trim()) respondQuestion(sessionId, requestId, customText.trim());
            }}
            disabled={!customText.trim()}
            style={{
              padding: '4px 10px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-default)',
              background: 'var(--bg-hover)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              opacity: customText.trim() ? 1 : 0.4,
            }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
