import React from 'react';
import { useWorkspaceStore } from '../../../stores/workspace-store';
import { useTabStore } from '../../../stores/tab-store';
import { gitApi, type GitFileDiff } from '../../../lib/tauri-ipc';
import { useGitStore } from '../stores/git-store';

export function GitFileDiffView() {
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace);
  const activeTabId = useTabStore((s) => s.activeTabId);
  const tabs = useTabStore((s) => s.tabs);
  const selectedRepo = useGitStore((s) => s.selectedRepo);

  const [diffData, setDiffData] = React.useState<GitFileDiff | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const filePath = (activeTab?.data?.filePath as string) || '';
  const staged = (activeTab?.data?.staged as boolean) ?? false;

  React.useEffect(() => {
    if (!activeWorkspace || !filePath || !selectedRepo) return;
    setDiffData(null);
    setError(null);
    gitApi
      .fileDiff(activeWorkspace.id, selectedRepo, filePath, staged)
      .then((d) => setDiffData(d))
      .catch((e) => setError(String(e)));
  }, [activeWorkspace, filePath, staged, selectedRepo]);

  if (error) {
    return (
      <div style={{ padding: 'var(--space-4)', color: 'var(--status-error)', fontSize: '12px' }}>
        {error}
      </div>
    );
  }

  if (!diffData) {
    return (
      <div style={{ padding: 'var(--space-4)', color: 'var(--text-disabled)', fontSize: '12px' }}>
        Loading...
      </div>
    );
  }

  const hasContent = diffData.diff.trim().length > 0;

  return (
    <div style={{ height: '100%', overflow: 'auto', fontFamily: 'var(--font-sans)' }}>
      {/* Header */}
      <div
        style={{
          padding: 'var(--space-3) var(--space-4)',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '13px',
            color: 'var(--text-primary)',
          }}
        >
          {diffData.path}
        </span>
        <span
          style={{
            fontSize: '10px',
            fontFamily: 'var(--font-mono)',
            padding: '2px 6px',
            borderRadius: 'var(--radius-sm)',
            background: staged ? 'rgba(45, 212, 191, 0.1)' : 'rgba(234, 179, 8, 0.1)',
            color: staged ? 'var(--accent-primary)' : '#e2b714',
          }}
        >
          {staged ? 'staged' : 'unstaged'}
        </span>
      </div>

      {/* Diff body */}
      {hasContent ? (
        <pre
          style={{
            margin: 0,
            padding: 'var(--space-3) var(--space-4)',
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            lineHeight: '1.5',
            whiteSpace: 'pre',
            overflowX: 'auto',
          }}
        >
          {diffData.diff.split('\n').map((line, i) => (
            <DiffLine key={i} line={line} />
          ))}
        </pre>
      ) : (
        <div
          style={{
            padding: 'var(--space-4)',
            color: 'var(--text-disabled)',
            fontSize: '12px',
            fontFamily: 'var(--font-mono)',
          }}
        >
          No diff available
        </div>
      )}
    </div>
  );
}

function DiffLine({ line }: { line: string }) {
  let color = 'var(--text-secondary)';
  let bg = 'transparent';

  if (line.startsWith('+')) {
    color = '#2dd4bf';
    bg = 'rgba(45, 212, 191, 0.07)';
  } else if (line.startsWith('-')) {
    color = '#ef4444';
    bg = 'rgba(239, 68, 68, 0.07)';
  } else if (line.startsWith('@@')) {
    color = '#22d3ee';
    bg = 'rgba(34, 211, 238, 0.05)';
  } else if (line.startsWith('diff ') || line.startsWith('index ')) {
    color = 'var(--text-disabled)';
  }

  return (
    <div style={{ color, background: bg, paddingLeft: '4px' }}>
      {line}
    </div>
  );
}
