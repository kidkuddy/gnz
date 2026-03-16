import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Eye, Pencil } from 'lucide-react';
import { useWorkspaceStore } from '../../../stores/workspace-store';
import { filesApi } from '../../../lib/tauri-ipc';
import type { Tab } from '../../../stores/tab-store';

interface Props {
  tab: Tab;
}

export function MarkdownFileView({ tab }: Props) {
  const filePath = tab.data?.filePath as string | undefined;
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace);
  const [content, setContent] = React.useState('');
  const [loaded, setLoaded] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [viewMode, setViewMode] = React.useState(true);

  React.useEffect(() => {
    if (!activeWorkspace || !filePath) return;
    setLoaded(false);
    setError(null);
    filesApi
      .read(activeWorkspace.id, filePath)
      .then((f) => {
        setContent(f.content);
        setLoaded(true);
      })
      .catch((e) => {
        setError(String(e));
        setLoaded(true);
      });
  }, [activeWorkspace, filePath]);

  if (!activeWorkspace) {
    return <div style={emptyStyle}>Select a workspace first</div>;
  }
  if (!filePath) {
    return <div style={emptyStyle}>No file selected</div>;
  }
  if (!loaded) {
    return <div style={emptyStyle}>Loading...</div>;
  }
  if (error) {
    return <div style={emptyStyle}>{error}</div>;
  }

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <span style={titleStyle}>{tab.title}</span>
        <button
          onClick={() => setViewMode((v) => !v)}
          style={toggleBtnStyle}
          title={viewMode ? 'Edit mode' : 'Preview mode'}
        >
          {viewMode ? <Pencil size={13} /> : <Eye size={13} />}
        </button>
      </div>
      {viewMode ? (
        <div style={previewStyle} className="md-body">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </div>
      ) : (
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          style={textareaStyle}
          spellCheck={false}
          readOnly
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
