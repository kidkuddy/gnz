import React from 'react';
import {
  GitBranch,
  ChevronDown,
  ChevronRight,
  RotateCw,
  ArrowUp,
  ArrowDown,
  Archive,
  Plus,
} from 'lucide-react';
import { PanelSection } from '../../../components/layout/Panel';
import { Button } from '../../../components/ui/Button';
import { useWorkspaceStore } from '../../../stores/workspace-store';
import { useTabStore } from '../../../stores/tab-store';
import { useGitStore } from '../stores/git-store';
import { FileChangeItem } from './FileChangeItem';
import { toast } from 'sonner';

export function GitPanel() {
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace);
  const addTab = useTabStore((s) => s.addTab);

  const repos = useGitStore((s) => s.repos);
  const selectedRepo = useGitStore((s) => s.selectedRepo);
  const status = useGitStore((s) => s.status);
  const stashes = useGitStore((s) => s.stashes);
  const branches = useGitStore((s) => s.branches);
  const commitMessage = useGitStore((s) => s.commitMessage);

  const loadRepos = useGitStore((s) => s.loadRepos);
  const selectRepo = useGitStore((s) => s.selectRepo);
  const stage = useGitStore((s) => s.stage);
  const unstage = useGitStore((s) => s.unstage);
  const discard = useGitStore((s) => s.discard);
  const commit = useGitStore((s) => s.commit);
  const push = useGitStore((s) => s.push);
  const pull = useGitStore((s) => s.pull);
  const stashApply = useGitStore((s) => s.stashApply);
  const stashDrop = useGitStore((s) => s.stashDrop);
  const stashPush = useGitStore((s) => s.stashPush);
  const setCommitMessage = useGitStore((s) => s.setCommitMessage);
  const refresh = useGitStore((s) => s.refresh);
  const checkoutBranch = useGitStore((s) => s.checkoutBranch);
  const createBranch = useGitStore((s) => s.createBranch);

  const [stashesOpen, setStashesOpen] = React.useState(false);
  const [repoDropdownOpen, setRepoDropdownOpen] = React.useState(false);
  const [branchDropdownOpen, setBranchDropdownOpen] = React.useState(false);
  const [newBranchName, setNewBranchName] = React.useState('');

  const wsId = activeWorkspace?.id;

  React.useEffect(() => {
    if (wsId) {
      loadRepos(wsId).catch(() => {});
    }
  }, [wsId, loadRepos]);

  // Auto-refresh every 30s
  React.useEffect(() => {
    if (!wsId) return;
    const interval = setInterval(() => {
      refresh(wsId).catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, [wsId, refresh]);

  const stagedFiles = status?.files.filter((f) => f.staged) || [];
  const unstagedFiles = status?.files.filter((f) => !f.staged) || [];

  const handleStageAll = async () => {
    if (!wsId) return;
    try {
      await stage(
        wsId,
        unstagedFiles.map((f) => f.path),
      );
    } catch (err) {
      toast.error(`Stage failed: ${err}`);
    }
  };

  const handleUnstageAll = async () => {
    if (!wsId) return;
    try {
      await unstage(
        wsId,
        stagedFiles.map((f) => f.path),
      );
    } catch (err) {
      toast.error(`Unstage failed: ${err}`);
    }
  };

  const handleCommit = async () => {
    if (!wsId) return;
    try {
      await commit(wsId);
      toast.success('Committed');
    } catch (err) {
      toast.error(`Commit failed: ${err}`);
    }
  };

  const handlePush = async () => {
    if (!wsId) return;
    try {
      await push(wsId);
      toast.success('Pushed');
    } catch (err) {
      toast.error(`Push failed: ${err}`);
    }
  };

  const handlePull = async () => {
    if (!wsId) return;
    try {
      await pull(wsId);
      toast.success('Pulled');
    } catch (err) {
      toast.error(`Pull failed: ${err}`);
    }
  };

  const handleRefresh = () => {
    if (!wsId) return;
    refresh(wsId).catch(() => {});
  };

  const handleStashPush = async () => {
    if (!wsId) return;
    try {
      await stashPush(wsId, '');
      toast.success('Stashed');
    } catch (err) {
      toast.error(`Stash failed: ${err}`);
    }
  };

  const handleCheckoutBranch = async (branch: string) => {
    if (!wsId) return;
    try {
      await checkoutBranch(wsId, branch);
      setBranchDropdownOpen(false);
      toast.success(`Switched to ${branch}`);
    } catch (err) {
      toast.error(`Checkout failed: ${err}`);
    }
  };

  const handleCreateBranch = async () => {
    if (!wsId || !newBranchName.trim()) return;
    try {
      await createBranch(wsId, newBranchName.trim());
      setNewBranchName('');
      setBranchDropdownOpen(false);
      toast.success(`Created and switched to ${newBranchName.trim()}`);
    } catch (err) {
      toast.error(`Create branch failed: ${err}`);
    }
  };

  const handleOpenHistory = () => {
    addTab({
      id: 'git-history',
      title: 'Git History',
      type: 'git-history',
      moduleId: 'git',
    });
  };

  const handleOpenFileDiff = (filePath: string, staged: boolean) => {
    const fileName = filePath.split('/').pop() || filePath;
    const tabId = `git-file-diff-${staged ? 'staged' : 'unstaged'}-${filePath}`;
    addTab({
      id: tabId,
      title: fileName,
      type: 'git-file-diff',
      moduleId: 'git',
      data: { filePath, staged },
    });
  };

  const currentRepo = repos.find((r) => r.path === selectedRepo);

  if (!activeWorkspace) {
    return (
      <div style={{ padding: 'var(--space-4)', color: 'var(--text-disabled)', fontSize: '12px' }}>
        Select a workspace first
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Repo selector */}
      <div style={{ padding: 'var(--space-2) var(--space-3)', borderBottom: '1px solid var(--border-subtle)' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            cursor: repos.length > 1 ? 'pointer' : 'default',
            position: 'relative',
          }}
          onClick={() => repos.length > 1 && setRepoDropdownOpen(!repoDropdownOpen)}
        >
          <GitBranch size={13} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: '12px',
                color: 'var(--text-primary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {currentRepo?.name || 'No repos'}
              {currentRepo && (
                <span style={{ color: 'var(--text-tertiary)', marginLeft: '6px' }}>
                  {currentRepo.branch}
                </span>
              )}
            </div>
            {currentRepo?.has_remote && (currentRepo.ahead > 0 || currentRepo.behind > 0) && (
              <div style={{ fontSize: '10px', color: 'var(--text-disabled)', marginTop: '1px' }}>
                {currentRepo.ahead > 0 && (
                  <span style={{ marginRight: '6px' }}>
                    <ArrowUp size={9} style={{ verticalAlign: 'middle' }} /> {currentRepo.ahead}
                  </span>
                )}
                {currentRepo.behind > 0 && (
                  <span>
                    <ArrowDown size={9} style={{ verticalAlign: 'middle' }} /> {currentRepo.behind}
                  </span>
                )}
              </div>
            )}
          </div>
          {repos.length > 1 && (
            <ChevronDown size={12} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleRefresh();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-tertiary)',
              padding: '2px',
            }}
            title="Refresh"
          >
            <RotateCw size={12} />
          </button>
        </div>
        {repoDropdownOpen && repos.length > 1 && (
          <div
            style={{
              marginTop: 'var(--space-1)',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              overflow: 'hidden',
            }}
          >
            {repos.map((repo) => (
              <div
                key={repo.path}
                onClick={() => {
                  if (wsId) selectRepo(wsId, repo.path);
                  setRepoDropdownOpen(false);
                }}
                style={{
                  padding: 'var(--space-2) var(--space-3)',
                  fontSize: '12px',
                  color: repo.path === selectedRepo ? 'var(--text-primary)' : 'var(--text-secondary)',
                  background: repo.path === selectedRepo ? 'var(--accent-muted)' : 'transparent',
                  cursor: 'pointer',
                }}
              >
                {repo.name}{' '}
                <span style={{ color: 'var(--text-disabled)' }}>({repo.branch})</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Branch switcher */}
      {selectedRepo && (
        <div style={{ padding: 'var(--space-1) var(--space-3)', borderBottom: '1px solid var(--border-subtle)' }}>
          <div
            onClick={() => setBranchDropdownOpen(!branchDropdownOpen)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              cursor: 'pointer',
              padding: '3px 0',
            }}
          >
            <GitBranch size={11} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {status?.branch || '—'}
            </span>
            <ChevronDown size={10} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
          </div>
          {branchDropdownOpen && (
            <div
              style={{
                marginTop: 'var(--space-1)',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                overflow: 'hidden',
              }}
            >
              {branches.map((b) => (
                <div
                  key={b.name}
                  onClick={() => !b.is_current && handleCheckoutBranch(b.name)}
                  style={{
                    padding: '4px var(--space-3)',
                    fontSize: '11px',
                    color: b.is_current ? 'var(--text-primary)' : 'var(--text-secondary)',
                    background: b.is_current ? 'var(--accent-muted)' : 'transparent',
                    cursor: b.is_current ? 'default' : 'pointer',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {b.is_current ? '* ' : '  '}{b.name}
                </div>
              ))}
              <div style={{ borderTop: '1px solid var(--border-subtle)', padding: 'var(--space-2) var(--space-3)', display: 'flex', gap: 'var(--space-2)' }}>
                <input
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateBranch()}
                  placeholder="new branch name..."
                  style={{
                    flex: 1,
                    background: 'var(--bg-base)',
                    border: 'none',
                    color: 'var(--text-primary)',
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)',
                    outline: 'none',
                  }}
                />
                <button
                  onClick={handleCreateBranch}
                  disabled={!newBranchName.trim()}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    background: 'none',
                    border: 'none',
                    cursor: newBranchName.trim() ? 'pointer' : 'default',
                    color: newBranchName.trim() ? 'var(--text-secondary)' : 'var(--text-disabled)',
                    padding: 0,
                  }}
                  title="Create branch"
                >
                  <Plus size={12} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Changes */}
      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        {/* Staged */}
        <PanelSection
          title={`Staged (${stagedFiles.length})`}
          action={
            stagedFiles.length > 0 ? (
              <Button size="sm" variant="secondary" onClick={handleUnstageAll} title="Unstage All">
                <span style={{ fontSize: '10px' }}>Unstage All</span>
              </Button>
            ) : undefined
          }
        >
          {stagedFiles.length === 0 ? (
            <div style={{ padding: '4px var(--space-3)', fontSize: '11px', color: 'var(--text-disabled)' }}>
              No staged changes
            </div>
          ) : (
            stagedFiles.map((f) => (
              <FileChangeItem
                key={`staged-${f.path}`}
                path={f.path}
                status={f.status}
                staged={true}
                onStage={() => {}}
                onUnstage={() => wsId && unstage(wsId, [f.path]).catch((e) => toast.error(`${e}`))}
                onDiscard={() => {}}
                onClick={() => handleOpenFileDiff(f.path, true)}
              />
            ))
          )}
        </PanelSection>

        {/* Unstaged */}
        <PanelSection
          title={`Changes (${unstagedFiles.length})`}
          action={
            unstagedFiles.length > 0 ? (
              <Button size="sm" variant="secondary" onClick={handleStageAll} title="Stage All">
                <Plus size={10} />
                <span style={{ fontSize: '10px' }}>Stage All</span>
              </Button>
            ) : undefined
          }
        >
          {unstagedFiles.length === 0 ? (
            <div style={{ padding: '4px var(--space-3)', fontSize: '11px', color: 'var(--text-disabled)' }}>
              No changes
            </div>
          ) : (
            unstagedFiles.map((f) => (
              <FileChangeItem
                key={`unstaged-${f.path}`}
                path={f.path}
                status={f.status}
                staged={false}
                onStage={() => wsId && stage(wsId, [f.path]).catch((e) => toast.error(`${e}`))}
                onUnstage={() => {}}
                onDiscard={() => wsId && discard(wsId, [f.path]).catch((e) => toast.error(`${e}`))}
                onClick={f.status !== '?' ? () => handleOpenFileDiff(f.path, false) : undefined}
              />
            ))
          )}
        </PanelSection>
      </div>

      {/* Commit area */}
      <div
        style={{
          padding: 'var(--space-2) var(--space-3)',
          borderTop: '1px solid var(--border-subtle)',
        }}
      >
        <textarea
          value={commitMessage}
          onChange={(e) => setCommitMessage(e.target.value)}
          placeholder="Commit message..."
          style={{
            width: '100%',
            minHeight: '52px',
            maxHeight: '120px',
            resize: 'vertical',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-sans)',
            fontSize: '12px',
            padding: 'var(--space-2)',
            outline: 'none',
            boxSizing: 'border-box',
          }}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              handleCommit();
            }
          }}
        />
        <div style={{ display: 'flex', gap: 'var(--space-1)', marginTop: 'var(--space-1)' }}>
          <Button
            size="sm"
            variant="primary"
            onClick={handleCommit}
            disabled={!commitMessage.trim() || stagedFiles.length === 0}
            style={{ flex: 1 }}
          >
            Commit
          </Button>
          {status?.has_remote && (
            <>
              <Button size="sm" variant="secondary" onClick={handlePush} title="Push">
                <ArrowUp size={12} />
              </Button>
              <Button size="sm" variant="secondary" onClick={handlePull} title="Pull">
                <ArrowDown size={12} />
              </Button>
            </>
          )}
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-1)', marginTop: 'var(--space-1)' }}>
          <Button size="sm" variant="secondary" onClick={handleOpenHistory} style={{ flex: 1 }}>
            History
          </Button>
        </div>
      </div>

      {/* Stashes */}
      <div style={{ borderTop: '1px solid var(--border-subtle)' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-1)',
            padding: 'var(--space-2) var(--space-3)',
            cursor: 'pointer',
            fontSize: '10px',
            fontWeight: 500,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--text-tertiary)',
          }}
          onClick={() => setStashesOpen(!stashesOpen)}
        >
          {stashesOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
          <span style={{ flex: 1 }}>Stashes ({stashes.length})</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleStashPush();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-tertiary)',
              padding: '2px',
            }}
            title="Stash changes"
          >
            <Archive size={11} />
          </button>
        </div>
        {stashesOpen && (
          <div style={{ maxHeight: '120px', overflow: 'auto' }}>
            {stashes.length === 0 ? (
              <div
                style={{
                  padding: '4px var(--space-3)',
                  fontSize: '11px',
                  color: 'var(--text-disabled)',
                }}
              >
                No stashes
              </div>
            ) : (
              stashes.map((s) => (
                <div
                  key={s.index}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-1)',
                    padding: '2px var(--space-3)',
                    fontSize: '11px',
                  }}
                >
                  <span
                    style={{
                      flex: 1,
                      color: 'var(--text-secondary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={s.message}
                  >
                    stash@{'{'}
                    {s.index}
                    {'}'}: {s.message}
                  </span>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => wsId && stashApply(wsId, s.index).catch((e) => toast.error(`${e}`))}
                    style={{ padding: '2px 6px', height: '20px', fontSize: '10px' }}
                  >
                    Apply
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => wsId && stashDrop(wsId, s.index).catch((e) => toast.error(`${e}`))}
                    style={{ padding: '2px 6px', height: '20px', fontSize: '10px' }}
                  >
                    Drop
                  </Button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
