import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Eye, Code } from 'lucide-react';
import { useWorkspaceStore } from '../../../stores/workspace-store';
import { useTabStore } from '../../../stores/tab-store';
import { filesApi, type FileContent } from '../../../lib/tauri-ipc';

const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  overflow: 'hidden',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: 'var(--space-3) var(--space-4)',
  borderBottom: '1px solid var(--border-subtle)',
  gap: 'var(--space-3)',
  flexShrink: 0,
};

const pathStyle: React.CSSProperties = {
  fontSize: '12px',
  fontFamily: 'var(--font-mono)',
  color: 'var(--text-tertiary)',
};

const sizeStyle: React.CSSProperties = {
  fontSize: '11px',
  fontFamily: 'var(--font-mono)',
  color: 'var(--text-disabled)',
  marginLeft: 'auto',
};

const contentAreaStyle: React.CSSProperties = {
  flex: 1,
  overflow: 'auto',
  display: 'flex',
};

const lineNumbersStyle: React.CSSProperties = {
  flexShrink: 0,
  padding: 'var(--space-3) var(--space-3)',
  textAlign: 'right',
  color: 'var(--text-disabled)',
  fontSize: '12px',
  fontFamily: 'var(--font-mono)',
  lineHeight: '1.6',
  userSelect: 'none',
  borderRight: '1px solid var(--border-subtle)',
};

const codeStyle: React.CSSProperties = {
  flex: 1,
  padding: 'var(--space-3) var(--space-4)',
  fontSize: '12px',
  fontFamily: 'var(--font-mono)',
  lineHeight: '1.6',
  color: 'var(--text-primary)',
  whiteSpace: 'pre',
  margin: 0,
  overflow: 'visible',
  tabSize: 4,
};

export function FileView() {
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace);
  const activeTabId = useTabStore((s) => s.activeTabId);
  const tabs = useTabStore((s) => s.tabs);
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const [file, setFile] = React.useState<FileContent | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [preview, setPreview] = React.useState(false);

  const filePath = activeTab?.data?.filePath as string | undefined;
  const isMarkdown = filePath?.endsWith('.md') ?? false;

  React.useEffect(() => {
    setPreview(filePath?.endsWith('.md') ?? false);
    if (!activeWorkspace || !filePath) return;
    setLoading(true);
    setError(null);
    filesApi
      .read(activeWorkspace.id, filePath)
      .then(setFile)
      .catch((err) => setError(String(err)))
      .finally(() => setLoading(false));
  }, [activeWorkspace, filePath]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-disabled)', fontSize: '13px' }}>
        Loading...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-error)', fontSize: '13px' }}>
        {error}
      </div>
    );
  }

  if (!file) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-disabled)', fontSize: '13px' }}>
        Select a file to view
      </div>
    );
  }

  const lines = file.content.split('\n');
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <span style={pathStyle}>{file.path}</span>
        {isMarkdown && (
          <button
            onClick={() => setPreview((v) => !v)}
            style={toggleBtnStyle}
            title={preview ? 'Show source' : 'Preview markdown'}
          >
            {preview ? <Code size={13} /> : <Eye size={13} />}
          </button>
        )}
        <span style={sizeStyle}>{formatSize(file.size)}</span>
      </div>
      {preview && isMarkdown ? (
        <div style={previewStyle} className="md-body">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{file.content}</ReactMarkdown>
        </div>
      ) : (
        <div style={contentAreaStyle}>
          <div style={lineNumbersStyle}>
            {lines.map((_, i) => (
              <div key={i}>{i + 1}</div>
            ))}
          </div>
          <pre style={codeStyle}>{file.content}</pre>
        </div>
      )}
    </div>
  );
}

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
  padding: 'var(--space-3) var(--space-4)',
  fontSize: '13px',
  lineHeight: '1.6',
};
