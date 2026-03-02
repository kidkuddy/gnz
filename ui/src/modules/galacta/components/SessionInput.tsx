import { useRef, useCallback, useState, useEffect } from 'react';
import { useGalactaStore, type Skill } from '../stores/galacta-store';

interface SessionInputProps {
  onSend: (text: string) => void;
  onAbort: () => void;
  streaming: boolean;
  disabled: boolean;
  workingDir: string;
}

export function SessionInput({ onSend, onAbort, streaming, disabled, workingDir }: SessionInputProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const skills = useGalactaStore(s => s.skills);
  const loadSkills = useGalactaStore(s => s.loadSkills);

  // Autocomplete state
  const [query, setQuery] = useState('');       // text after the leading /
  const [showAC, setShowAC] = useState(false);
  const [acIndex, setAcIndex] = useState(0);

  // Load skills on mount so autocomplete is ready
  useEffect(() => {
    if (workingDir) loadSkills(workingDir);
  }, [workingDir]);

  const filtered: Skill[] = query === ''
    ? skills
    : skills.filter(s => s.name.startsWith(query));

  const closeAC = () => { setShowAC(false); setAcIndex(0); };

  const applySkill = (skill: Skill) => {
    if (!ref.current) return;
    // Replace everything from the leading / through the current query
    const val = ref.current.value;
    const slashIdx = val.lastIndexOf('/');
    if (slashIdx !== -1) {
      ref.current.value = val.slice(0, slashIdx) + '/' + skill.name + ' ';
    }
    closeAC();
    ref.current.focus();
    autoResize();
  };

  const handleInput = () => {
    autoResize();
    const val = ref.current?.value ?? '';
    // Only trigger when the very first char on the current line is /
    const lastNewline = val.lastIndexOf('\n');
    const lineStart = lastNewline === -1 ? 0 : lastNewline + 1;
    const line = val.slice(lineStart);

    if (line.startsWith('/') && !line.includes(' ')) {
      setQuery(line.slice(1));
      setShowAC(true);
      setAcIndex(0);
    } else {
      closeAC();
    }
  };

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Autocomplete navigation
    if (showAC && filtered.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setAcIndex(i => (i + 1) % filtered.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setAcIndex(i => (i - 1 + filtered.length) % filtered.length);
        return;
      }
      if (e.key === 'Tab' || e.key === 'Enter' && showAC) {
        e.preventDefault();
        applySkill(filtered[acIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        closeAC();
        return;
      }
    }

    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      const text = ref.current?.value.trim();
      if (text) {
        onSend(text);
        if (ref.current) ref.current.value = '';
        closeAC();
        autoResize();
      }
    }
    if (e.key === 'Escape' && streaming) {
      e.preventDefault();
      onAbort();
    }
  }, [onSend, onAbort, streaming, showAC, filtered, acIndex]);

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
        position: 'relative',
      }}
    >
      {/* Slash command autocomplete popover */}
      {showAC && filtered.length > 0 && (
        <div
          style={{
            position: 'absolute',
            bottom: '100%',
            left: 12,
            right: streaming ? 72 : 12,
            marginBottom: 4,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
            zIndex: 50,
            maxHeight: 240,
            overflowY: 'auto',
          }}
        >
          {filtered.map((skill, i) => (
            <div
              key={skill.name}
              onMouseDown={(e) => { e.preventDefault(); applySkill(skill); }}
              style={{
                padding: '6px 10px',
                background: i === acIndex ? 'var(--bg-active)' : 'transparent',
                cursor: 'pointer',
                display: 'flex',
                gap: 8,
                alignItems: 'baseline',
              }}
              onMouseEnter={() => setAcIndex(i)}
            >
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                color: i === acIndex ? 'var(--accent)' : 'var(--text-primary)',
                flexShrink: 0,
              }}>
                /{skill.name}
              </span>
              {skill.description && (
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  color: 'var(--text-tertiary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {skill.description}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      <textarea
        ref={ref}
        disabled={disabled}
        placeholder={streaming ? 'Streaming… (Esc to abort)' : 'Message Galacta… (⌘+Enter to send)'}
        onKeyDown={handleKeyDown}
        onInput={handleInput}
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
