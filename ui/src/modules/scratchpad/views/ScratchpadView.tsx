import React from 'react';
import { useWorkspaceStore } from '../../../stores/workspace-store';
import { useScratchpadStore } from '../stores/scratchpad-store';

export function ScratchpadView() {
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace);
  const content = useScratchpadStore((s) => s.content);
  const loaded = useScratchpadStore((s) => s.loaded);
  const saving = useScratchpadStore((s) => s.saving);
  const load = useScratchpadStore((s) => s.load);
  const save = useScratchpadStore((s) => s.save);
  const setContent = useScratchpadStore((s) => s.setContent);

  const saveTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    if (activeWorkspace) {
      load(activeWorkspace.id);
    }
    return () => {
      useScratchpadStore.getState().reset();
    };
  }, [activeWorkspace, load]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setContent(value);

    // Debounced auto-save
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    if (activeWorkspace) {
      saveTimeoutRef.current = setTimeout(() => {
        save(activeWorkspace.id, value);
      }, 500);
    }
  };

  // Save on unmount if there's a pending timeout
  React.useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        const ws = useWorkspaceStore.getState().activeWorkspace;
        const pad = useScratchpadStore.getState();
        if (ws) {
          scratchpadApi_save(ws.id, pad.content);
        }
      }
    };
  }, []);

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
        <span style={titleStyle}>Scratchpad</span>
        {saving && <span style={savingStyle}>Saving...</span>}
      </div>
      <textarea
        value={content}
        onChange={handleChange}
        placeholder="Notes, todos, anything..."
        style={textareaStyle}
        spellCheck={false}
      />
    </div>
  );
}

// Direct import for unmount save
import { scratchpadApi } from '../../../lib/tauri-ipc';
const scratchpadApi_save = scratchpadApi.save;

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

const savingStyle: React.CSSProperties = {
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
