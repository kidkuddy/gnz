import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Eye, Pencil } from 'lucide-react';
import { useWorkspaceStore } from '../../../stores/workspace-store';
import { useScratchpadStore } from '../stores/scratchpad-store';
import type { Tab } from '../../../stores/tab-store';

interface Props {
  tab: Tab;
}

export function ScratchpadView({ tab }: Props) {
  const padId = tab.data?.padId as string | undefined;
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace);
  const padStates = useScratchpadStore((s) => s.padStates);
  const loadPadContent = useScratchpadStore((s) => s.loadPadContent);
  const savePad = useScratchpadStore((s) => s.savePad);
  const setPadContent = useScratchpadStore((s) => s.setPadContent);

  const [viewMode, setViewMode] = React.useState(false);

  const padState = padId ? padStates[padId] : undefined;
  const content = padState?.content ?? '';
  const savedContent = padState?.savedContent ?? '';
  const loaded = padState?.loaded ?? false;
  const saving = padState?.saving ?? false;
  const dirty = content !== savedContent;

  React.useEffect(() => {
    if (activeWorkspace && padId) {
      loadPadContent(activeWorkspace.id, padId);
    }
  }, [activeWorkspace, padId, loadPadContent]);

  // Cmd+S to save
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (activeWorkspace && padId) {
          savePad(activeWorkspace.id, padId);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeWorkspace, padId, savePad]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (padId) setPadContent(padId, e.target.value);
  };

  if (!activeWorkspace) {
    return (
      <div style={emptyStyle}>
        <span>Select a workspace first</span>
      </div>
    );
  }

  if (!padId) {
    return (
      <div style={emptyStyle}>
        <span>No scratchpad selected</span>
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
          <span style={titleStyle}>{tab.title}</span>
          {dirty && <span style={dirtyDotStyle} title="Unsaved changes" />}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {saving && <span style={savingStyle}>Saving...</span>}
          {!saving && !dirty && <span style={savedStyle}>Saved</span>}
          <button
            onClick={() => setViewMode((v) => !v)}
            style={toggleBtnStyle}
            title={viewMode ? 'Edit mode' : 'Preview mode'}
          >
            {viewMode ? <Pencil size={13} /> : <Eye size={13} />}
          </button>
        </div>
      </div>
      {viewMode ? (
        <div style={previewStyle} className="md-body">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </div>
      ) : (
        <textarea
          value={content}
          onChange={handleChange}
          placeholder="Notes, todos, anything... (Cmd+S to save)"
          style={textareaStyle}
          spellCheck={false}
        />
      )}
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

const toggleBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--text-tertiary)',
  padding: '2px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '4px',
  transition: 'color 0.15s',
};

const previewStyle: React.CSSProperties = {
  flex: 1,
  overflow: 'auto',
  padding: 'var(--space-3)',
  fontSize: '13px',
  lineHeight: '1.6',
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
