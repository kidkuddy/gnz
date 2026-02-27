import React from 'react';
import { useWorkspaceStore } from '../../../stores/workspace-store';
import { useTabStore } from '../../../stores/tab-store';
import { useGitStore } from '../stores/git-store';
import type { GitCommit } from '../../../lib/tauri-ipc';

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

export function GitHistoryView() {
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace);
  const addTab = useTabStore((s) => s.addTab);
  const commits = useGitStore((s) => s.commits);
  const loadCommits = useGitStore((s) => s.loadCommits);
  const selectedRepo = useGitStore((s) => s.selectedRepo);

  React.useEffect(() => {
    if (activeWorkspace) {
      loadCommits(activeWorkspace.id, 100).catch(() => {});
    }
  }, [activeWorkspace, loadCommits, selectedRepo]);

  const handleClickCommit = (c: GitCommit) => {
    addTab({
      id: `git-diff-${c.hash}`,
      title: `${c.hash.slice(0, 7)} ${c.message.slice(0, 30)}`,
      type: 'git-diff',
      moduleId: 'git',
      data: { hash: c.hash },
    });
  };

  if (!activeWorkspace) {
    return (
      <div style={{ padding: 'var(--space-4)', color: 'var(--text-disabled)', fontSize: '12px' }}>
        Select a workspace
      </div>
    );
  }

  return (
    <div style={{ height: '100%', overflow: 'auto', fontFamily: 'var(--font-sans)' }}>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '12px',
        }}
      >
        <thead>
          <tr
            style={{
              position: 'sticky',
              top: 0,
              background: 'var(--bg-base)',
              borderBottom: '1px solid var(--border-subtle)',
              zIndex: 1,
            }}
          >
            <th style={thStyle}>Hash</th>
            <th style={{ ...thStyle, width: '100%' }}>Message</th>
            <th style={thStyle}>Author</th>
            <th style={thStyle}>Date</th>
          </tr>
        </thead>
        <tbody>
          {commits.map((c) => (
            <CommitRow key={c.hash} commit={c} onClick={() => handleClickCommit(c)} />
          ))}
          {commits.length === 0 && (
            <tr>
              <td
                colSpan={4}
                style={{
                  padding: 'var(--space-4)',
                  textAlign: 'center',
                  color: 'var(--text-disabled)',
                }}
              >
                No commits found
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: 'var(--space-2) var(--space-3)',
  fontSize: '10px',
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'var(--text-tertiary)',
  whiteSpace: 'nowrap',
};

function CommitRow({ commit, onClick }: { commit: GitCommit; onClick: () => void }) {
  const [hovered, setHovered] = React.useState(false);

  const cellStyle: React.CSSProperties = {
    padding: 'var(--space-1) var(--space-3)',
    whiteSpace: 'nowrap',
    color: 'var(--text-secondary)',
  };

  return (
    <tr
      style={{
        cursor: 'pointer',
        background: hovered ? 'var(--bg-hover)' : 'transparent',
        transition: 'background 80ms ease',
      }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <td style={{ ...cellStyle, fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)' }}>
        {commit.hash.slice(0, 7)}
      </td>
      <td
        style={{
          ...cellStyle,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          maxWidth: '0',
          color: 'var(--text-primary)',
        }}
      >
        {commit.message}
      </td>
      <td style={cellStyle}>{commit.author}</td>
      <td style={{ ...cellStyle, color: 'var(--text-disabled)' }}>{relativeDate(commit.date)}</td>
    </tr>
  );
}
