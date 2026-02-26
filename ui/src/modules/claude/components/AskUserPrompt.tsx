import React from 'react';
import { MessageCircleQuestion, Check } from 'lucide-react';
import type { AskUserQuestion } from '../stores/session-store';

interface AskUserPromptProps {
  toolUseId: string;
  questions: AskUserQuestion[];
  answered: boolean;
  selectedAnswer?: string;
  onRespond: (toolUseId: string, result: string) => void;
}

export function AskUserPrompt({ toolUseId, questions, answered, selectedAnswer, onRespond }: AskUserPromptProps) {
  const [customText, setCustomText] = React.useState('');
  const [selectedOptions, setSelectedOptions] = React.useState<Record<number, string>>({});

  if (answered) {
    return (
      <div style={answeredContainerStyle}>
        <div style={answeredHeaderStyle}>
          <Check size={12} />
          <span>Answered</span>
        </div>
        <div style={answeredTextStyle}>{selectedAnswer}</div>
      </div>
    );
  }

  const handleOptionClick = (questionIdx: number, label: string) => {
    setSelectedOptions((prev) => ({ ...prev, [questionIdx]: label }));
  };

  const handleSubmit = () => {
    // Build a JSON response matching what AskUserQuestion expects
    const answers: Record<string, string> = {};
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const selected = selectedOptions[i];
      if (selected) {
        answers[q.question] = selected;
      }
    }

    // If there's custom text and only one question, use that
    if (customText.trim() && questions.length > 0) {
      answers[questions[0].question] = customText.trim();
    }

    const resultPayload = JSON.stringify({ questions: questions.map((q) => ({ question: q.question })), answers });
    onRespond(toolUseId, resultPayload);
  };

  const canSubmit = Object.keys(selectedOptions).length > 0 || customText.trim().length > 0;

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <MessageCircleQuestion size={13} />
        <span>Claude needs your input</span>
      </div>

      {questions.map((q, qIdx) => (
        <div key={qIdx} style={questionBlockStyle}>
          {q.header && <div style={questionHeaderStyle}>{q.header}</div>}
          <div style={questionTextStyle}>{q.question}</div>

          {q.options && q.options.length > 0 && (
            <div style={optionsContainerStyle}>
              {q.options.map((opt, optIdx) => {
                const isSelected = selectedOptions[qIdx] === opt.label;
                return (
                  <button
                    key={optIdx}
                    style={{
                      ...optionButtonStyle,
                      ...(isSelected ? optionSelectedStyle : {}),
                    }}
                    onClick={() => handleOptionClick(qIdx, opt.label)}
                  >
                    <span style={optionLabelStyle}>{opt.label}</span>
                    {opt.description && (
                      <span style={optionDescStyle}>{opt.description}</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ))}

      <div style={inputRowStyle}>
        <input
          type="text"
          value={customText}
          onChange={(e) => setCustomText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && canSubmit) handleSubmit();
          }}
          placeholder="Type a custom response..."
          style={textInputStyle}
        />
        <button
          style={{
            ...submitButtonStyle,
            ...(canSubmit ? {} : submitDisabledStyle),
          }}
          onClick={handleSubmit}
          disabled={!canSubmit}
        >
          Send
        </button>
      </div>
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  marginTop: 'var(--space-2)',
  marginBottom: 'var(--space-2)',
  background: 'var(--bg-elevated)',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--accent-teal, #2dd4bf)',
  overflow: 'hidden',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-1)',
  padding: 'var(--space-2)',
  fontSize: '12px',
  fontWeight: 500,
  color: 'var(--accent-teal, #2dd4bf)',
  borderBottom: '1px solid var(--border-subtle)',
};

const questionBlockStyle: React.CSSProperties = {
  padding: 'var(--space-2)',
};

const questionHeaderStyle: React.CSSProperties = {
  fontSize: '10px',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'var(--text-tertiary)',
  marginBottom: 'var(--space-1)',
};

const questionTextStyle: React.CSSProperties = {
  fontSize: '12.5px',
  fontFamily: 'var(--font-mono)',
  color: 'var(--text-primary)',
  marginBottom: 'var(--space-2)',
  lineHeight: 1.5,
};

const optionsContainerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
};

const optionButtonStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
  padding: 'var(--space-1) var(--space-2)',
  background: 'var(--bg-base)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-sm)',
  cursor: 'pointer',
  textAlign: 'left',
  fontSize: '12px',
  fontFamily: 'var(--font-mono)',
  color: 'var(--text-secondary)',
  transition: 'border-color 0.1s, background 0.1s',
};

const optionSelectedStyle: React.CSSProperties = {
  borderColor: 'var(--accent-teal, #2dd4bf)',
  background: 'rgba(45, 212, 191, 0.08)',
};

const optionLabelStyle: React.CSSProperties = {
  fontWeight: 500,
  color: 'var(--text-primary)',
};

const optionDescStyle: React.CSSProperties = {
  fontSize: '11px',
  color: 'var(--text-tertiary)',
};

const inputRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 'var(--space-1)',
  padding: '0 var(--space-2) var(--space-2)',
};

const textInputStyle: React.CSSProperties = {
  flex: 1,
  padding: 'var(--space-1) var(--space-2)',
  background: 'var(--bg-base)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-sm)',
  fontSize: '12px',
  fontFamily: 'var(--font-mono)',
  color: 'var(--text-primary)',
  outline: 'none',
};

const submitButtonStyle: React.CSSProperties = {
  padding: 'var(--space-1) var(--space-3)',
  background: 'var(--accent-teal, #2dd4bf)',
  border: 'none',
  borderRadius: 'var(--radius-sm)',
  fontSize: '12px',
  fontWeight: 500,
  color: 'var(--bg-base, #0a0a0b)',
  cursor: 'pointer',
};

const submitDisabledStyle: React.CSSProperties = {
  opacity: 0.4,
  cursor: 'not-allowed',
};

const answeredContainerStyle: React.CSSProperties = {
  marginTop: 'var(--space-2)',
  marginBottom: 'var(--space-1)',
  background: 'var(--bg-elevated)',
  borderRadius: 'var(--radius-sm)',
  overflow: 'hidden',
  opacity: 0.7,
};

const answeredHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-1)',
  padding: 'var(--space-1) var(--space-2)',
  fontSize: '11px',
  color: 'var(--text-disabled)',
};

const answeredTextStyle: React.CSSProperties = {
  padding: '0 var(--space-2) var(--space-1)',
  fontSize: '11px',
  fontFamily: 'var(--font-mono)',
  color: 'var(--text-tertiary)',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
};
