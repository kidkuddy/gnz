import React from 'react';
import { Check } from 'lucide-react';
import type { AskUserQuestion } from '../stores/session-store';

interface AskUserPromptProps {
  toolUseId: string;
  questions: AskUserQuestion[];
  answered: boolean;
  selectedAnswer?: string;
  onRespond: (toolUseId: string, result: string) => void;
}

export function AskUserPrompt({ toolUseId, questions, answered, selectedAnswer, onRespond }: AskUserPromptProps) {
  const [showOtherInput, setShowOtherInput] = React.useState<Record<number, boolean>>({});
  const [otherText, setOtherText] = React.useState<Record<number, string>>({});

  if (answered) {
    return (
      <div style={answeredStyle}>
        <Check size={11} style={{ color: 'var(--text-disabled)', flexShrink: 0 }} />
        <span style={{ color: 'var(--text-disabled)' }}>{selectedAnswer}</span>
      </div>
    );
  }

  const handleSelect = (questionIdx: number, label: string) => {
    if (label === '__other__') {
      setShowOtherInput((prev) => ({ ...prev, [questionIdx]: true }));
      return;
    }
    submitAnswer(questionIdx, label);
  };

  const handleOtherSubmit = (questionIdx: number) => {
    const text = (otherText[questionIdx] || '').trim();
    if (!text) return;
    submitAnswer(questionIdx, text);
  };

  const submitAnswer = (_questionIdx: number, answer: string) => {
    const answers: Record<string, string> = {};
    if (questions.length === 1) {
      answers[questions[0].question] = answer;
    }
    const resultPayload = JSON.stringify({ questions: questions.map((q) => ({ question: q.question })), answers });
    onRespond(toolUseId, resultPayload);
  };

  return (
    <div style={containerStyle}>
      {questions.map((q, qIdx) => (
        <div key={qIdx} style={questionStyle}>
          <div style={questionTextStyle}>{q.question}</div>
          <div style={chipsRowStyle}>
            {q.options?.map((opt, optIdx) => (
              <button
                key={optIdx}
                style={chipStyle}
                title={opt.description}
                onClick={() => handleSelect(qIdx, opt.label)}
              >
                {opt.label}
              </button>
            ))}
            <button
              style={{ ...chipStyle, ...chipOtherStyle }}
              onClick={() => handleSelect(qIdx, '__other__')}
            >
              Other
            </button>
          </div>
          {showOtherInput[qIdx] && (
            <div style={otherRowStyle}>
              <input
                type="text"
                autoFocus
                value={otherText[qIdx] || ''}
                onChange={(e) => setOtherText((prev) => ({ ...prev, [qIdx]: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleOtherSubmit(qIdx);
                }}
                placeholder="Type your answer..."
                style={otherInputStyle}
              />
              <button style={otherSendStyle} onClick={() => handleOtherSubmit(qIdx)}>
                Send
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  margin: '6px 0',
  padding: '8px 10px',
  background: 'rgba(255, 255, 255, 0.02)',
  borderRadius: 'var(--radius-sm)',
};

const questionStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
};

const questionTextStyle: React.CSSProperties = {
  fontSize: '12.5px',
  color: 'var(--text-primary)',
  lineHeight: 1.5,
};

const chipsRowStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '4px',
};

const chipStyle: React.CSSProperties = {
  padding: '3px 10px',
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-default)',
  borderRadius: '10px',
  fontSize: '11.5px',
  fontFamily: 'var(--font-mono)',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  transition: 'border-color 0.1s, color 0.1s',
};

const chipOtherStyle: React.CSSProperties = {
  color: 'var(--text-tertiary)',
  borderStyle: 'dashed',
};

const otherRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '4px',
  marginTop: '2px',
};

const otherInputStyle: React.CSSProperties = {
  flex: 1,
  padding: '3px 8px',
  background: 'var(--bg-base)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  fontSize: '12px',
  fontFamily: 'var(--font-mono)',
  color: 'var(--text-primary)',
  outline: 'none',
};

const otherSendStyle: React.CSSProperties = {
  padding: '3px 10px',
  background: 'var(--text-primary)',
  border: 'none',
  borderRadius: 'var(--radius-sm)',
  fontSize: '11.5px',
  fontWeight: 500,
  color: '#000',
  cursor: 'pointer',
};

const answeredStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  margin: '4px 0',
  fontSize: '11.5px',
  fontFamily: 'var(--font-mono)',
  opacity: 0.6,
};
