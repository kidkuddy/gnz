import React from 'react';
import { useWorkspaceStore } from '../../../stores/workspace-store';
import { useTabStore } from '../../../stores/tab-store';
import { gitApi, type GitCommitDiff } from '../../../lib/tauri-ipc';
import { useGitStore } from '../stores/git-store';

function relativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths}mo ago`;
  return `${Math.floor(diffMonths / 12)}y ago`;
}

export function GitDiffView() {
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace);
  const activeTabId = useTabStore((s) => s.activeTabId);
  const tabs = useTabStore((s) => s.tabs);
  const selectedRepo = useGitStore((s) => s.selectedRepo);

  const [diffData, setDiffData] = React.useState<GitCommitDiff | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const hash = (activeTab?.data?.hash as string) || '';

  React.useEffect(() => {
    if (!activeWorkspace || !hash || !selectedRepo) return;
    setDiffData(null);
    setError(null);
    gitApi
      .diff(activeWorkspace.id, selectedRepo, hash)
      .then((d) => setDiffData(d))
      .catch((e) => setError(String(e)));
  }, [activeWorkspace, hash, selectedRepo]);

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

  return (
    <div style={{ height: '100%', overflow: 'auto', fontFamily: 'var(--font-sans)' }}>
      {/* Header */}
      <div
        style={{
          padding: 'var(--space-3) var(--space-4)',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-2)' }}>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '13px',
              color: 'var(--accent-primary)',
            }}
          >
            {diffData.hash.slice(0, 10)}
          </span>
          <span style={{ fontSize: '11px', color: 'var(--text-disabled)' }}>
            {diffData.author} &middot; {relativeDate(diffData.date)}
          </span>
        </div>
        <div
          style={{
            fontSize: '13px',
            color: 'var(--text-primary)',
            marginTop: 'var(--space-1)',
            whiteSpace: 'pre-wrap',
          }}
        >
          {diffData.message}
        </div>
      </div>

      {/* Diff body */}
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
