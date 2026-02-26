import React from 'react';
import { File, Loader2 } from 'lucide-react';
import { PanelSection } from '../../../components/layout/Panel';
import { useWorkspaceStore } from '../../../stores/workspace-store';
import { useTabStore } from '../../../stores/tab-store';
import { useSearchStore } from '../stores/search-store';

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: '28px',
  padding: '0 var(--space-3)',
  background: 'var(--bg-elevated)',
  border: 'none',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text-primary)',
  fontSize: '12px',
  fontFamily: 'var(--font-mono)',
  outline: 'none',
};

export function SearchPanel() {
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace);
  const addTab = useTabStore((s) => s.addTab);
  const query = useSearchStore((s) => s.query);
  const results = useSearchStore((s) => s.results);
  const loading = useSearchStore((s) => s.loading);
  const setQuery = useSearchStore((s) => s.setQuery);
  const search = useSearchStore((s) => s.search);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (activeWorkspace && val.trim()) {
      timerRef.current = setTimeout(() => {
        search(activeWorkspace.id, val);
      }, 300);
    }
  };

  const handleSelectFile = (path: string, name: string) => {
    addTab({
      id: `file-${path}`,
      title: name,
      type: 'file-viewer',
      moduleId: 'search',
      data: { filePath: path },
    });
  };

  if (!activeWorkspace) {
    return (
      <div style={{ padding: 'var(--space-4)', color: 'var(--text-disabled)', fontSize: '12px' }}>
        Select a workspace first
      </div>
    );
  }

  return (
    <>
      <div style={{ padding: 'var(--space-3)' }}>
        <input
          style={inputStyle}
          type="text"
          placeholder="Search files..."
          value={query}
          onChange={handleChange}
          autoFocus
        />
      </div>

      <PanelSection title={loading ? 'Searching...' : results.length > 0 ? `Results (${results.length})` : 'Results'}>
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-4)' }}>
            <Loader2 size={14} style={{ animation: 'spin 1s linear infinite', color: 'var(--text-disabled)' }} />
          </div>
        )}
        {!loading && results.length === 0 && query.trim() && (
          <div style={{ padding: 'var(--space-3)', color: 'var(--text-disabled)', fontSize: '12px' }}>
            No files found
          </div>
        )}
        {!loading && results.map((file) => (
          <FileResult
            key={file.path}
            path={file.path}
            name={file.name}
            size={file.size}
            onClick={() => handleSelectFile(file.path, file.name)}
          />
        ))}
      </PanelSection>
    </>
  );
}

function FileResult({ path, name, size, onClick }: { path: string; name: string; size: number; onClick: () => void }) {
  const [hovered, setHovered] = React.useState(false);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        padding: '4px var(--space-3)',
        cursor: 'pointer',
        background: hovered ? 'var(--bg-hover)' : 'transparent',
        fontSize: '12px',
      }}
    >
      <File size={12} style={{ flexShrink: 0, color: 'var(--text-disabled)' }} />
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <div style={{ color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {name}
        </div>
        <div style={{ color: 'var(--text-disabled)', fontSize: '10px', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {path}
        </div>
      </div>
      <span style={{ flexShrink: 0, color: 'var(--text-disabled)', fontSize: '10px', fontFamily: 'var(--font-mono)' }}>
        {formatSize(size)}
      </span>
    </div>
  );
}
