import React from 'react';
import { useWorkspaceStore } from '../../../stores/workspace-store';
import { useScratchpadStore } from '../stores/scratchpad-store';

export function ScratchpadView() {
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace);
  const content = useScratchpadStore((s) => s.content);
  const savedContent = useScratchpadStore((s) => s.savedContent);
  const loaded = useScratchpadStore((s) => s.loaded);
  const saving = useScratchpadStore((s) => s.saving);
  const load = useScratchpadStore((s) => s.load);
  const save = useScratchpadStore((s) => s.save);
  const setContent = useScratchpadStore((s) => s.setContent);

  const dirty = content !== savedContent;

  React.useEffect(() => {
    if (activeWorkspace) {
      load(activeWorkspace.id);
    }
    return () => {
      useScratchpadStore.getState().reset();
    };
  }, [activeWorkspace, load]);

  // Cmd+S to save
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (activeWorkspace) {
          save(activeWorkspace.id);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeWorkspace, save]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
  };

  if (!activeWorkspace) {
    return (
      <div style={emptyStyle}>
        <span>Select a workspace first</span>
      </div>
    );
  }

  if (!loaded) {
    return (
      <div style={emptyStyle}>
        <span>Loading...</span>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={titleStyle}>Scratchpad</span>
          {dirty && <span style={dirtyDotStyle} title="Unsaved changes" />}
        </div>
        {saving && <span style={savingStyle}>Saving...</span>}
        {!saving && !dirty && <span style={savedStyle}>Saved</span>}
      </div>
      <textarea
        value={content}
        onChange={handleChange}
        placeholder="Notes, todos, anything... (Cmd+S to save)"
        style={textareaStyle}
        spellCheck={false}
      />
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  overflow: 'hidden',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: 'var(--space-2) var(--space-3)',
  borderBottom: '1px solid var(--border-subtle)',
  flexShrink: 0,
};

const titleStyle: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'var(--text-tertiary)',
};

const dirtyDotStyle: React.CSSProperties = {
  width: '6px',
  height: '6px',
  borderRadius: '50%',
  background: 'var(--accent, #2dd4bf)',
  flexShrink: 0,
};

const savingStyle: React.CSSProperties = {
  fontSize: '10px',
  color: 'var(--text-disabled)',
  fontFamily: 'var(--font-mono)',
};

const savedStyle: React.CSSProperties = {
  fontSize: '10px',
  color: 'var(--text-disabled)',
  fontFamily: 'var(--font-mono)',
};

const textareaStyle: React.CSSProperties = {
  flex: 1,
  width: '100%',
  padding: 'var(--space-3)',
  background: 'transparent',
  color: 'var(--text-primary)',
  border: 'none',
  outline: 'none',
  resize: 'none',
  fontSize: '13px',
  lineHeight: '1.6',
  fontFamily: 'var(--font-mono)',
};

const emptyStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  color: 'var(--text-disabled)',
  fontFamily: 'var(--font-mono)',
  fontSize: '13px',
};
