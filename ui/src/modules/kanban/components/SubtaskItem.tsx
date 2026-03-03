import React from 'react';
import type { KanbanSubtask } from '../../../lib/tauri-ipc';

interface SubtaskItemProps {
  subtask: KanbanSubtask;
  allSubtasks: KanbanSubtask[];
  workspaceId: string;
  cardId: string;
  onUpdate: (patch: Partial<KanbanSubtask>) => void;
  onDelete: () => void;
  onLaunch: () => void;
  onRetry: () => void;
  onOpenSession: () => void;
}

export function SubtaskItem({
  subtask,
  allSubtasks,
  onUpdate,
  onDelete,
  onLaunch,
  onRetry,
  onOpenSession,
}: SubtaskItemProps) {
  const [expanded, setExpanded] = React.useState(false);
  const [promptValue, setPromptValue] = React.useState(subtask.prompt);
  const [editingTitle, setEditingTitle] = React.useState(false);
  const [titleValue, setTitleValue] = React.useState(subtask.title);
  const [hovered, setHovered] = React.useState(false);

  React.useEffect(() => {
    setPromptValue(subtask.prompt);
    setTitleValue(subtask.title);
  }, [subtask.prompt, subtask.title]);

  const blockers = subtask.context_deps
    .map((depId) => allSubtasks.find((st) => st.id === depId))
    .filter((dep): dep is KanbanSubtask => dep !== undefined && dep.status !== 'done');

  const canLaunch = blockers.length === 0 && subtask.status === 'pending';
  const canRetry = subtask.status === 'done' || subtask.status === 'running';
  const blockerTooltip = blockers.length > 0
    ? `Blocked by: ${blockers.map((b) => b.title).join(', ')}`
    : undefined;

  const handlePromptBlur = () => {
    if (promptValue !== subtask.prompt) {
      onUpdate({ prompt: promptValue });
    }
  };

  const handleTitleBlur = () => {
    setEditingTitle(false);
    const trimmed = titleValue.trim();
    if (trimmed && trimmed !== subtask.title) {
      onUpdate({ title: trimmed });
    } else {
      setTitleValue(subtask.title);
    }
  };

  const toggleDep = (depId: string) => {
    const current = subtask.context_deps;
    const next = current.includes(depId)
      ? current.filter((id) => id !== depId)
      : [...current, depId];
    onUpdate({ context_deps: next });
  };

  const statusDot = {
    pending: { color: 'var(--text-disabled)', label: 'pending', clickable: false },
    running: { color: 'var(--text-secondary)', label: '▶ running', clickable: true },
    done:    { color: 'var(--text-tertiary)',  label: '✓ done',    clickable: !!subtask.session_id },
  }[subtask.status];

  return (
    <div
      style={{ borderBottom: '1px solid var(--border-subtle)', padding: 'var(--space-2) var(--space-3)' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
        {/* Expand toggle */}
        <button
          onClick={() => setExpanded((e) => !e)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-disabled)', fontSize: '9px', padding: 0, flexShrink: 0, lineHeight: 1,
          }}
        >
          {expanded ? '▼' : '▶'}
        </button>

        {/* Title — click to edit */}
        {editingTitle ? (
          <input
            autoFocus
            value={titleValue}
            onChange={(e) => setTitleValue(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleTitleBlur();
              if (e.key === 'Escape') { setTitleValue(subtask.title); setEditingTitle(false); }
            }}
            style={{
              flex: 1,
              background: 'var(--bg-base)',
              border: '1px solid var(--border-strong)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-primary)',
              fontSize: '12px',
              padding: '1px 4px',
              fontFamily: 'var(--font-sans)',
              outline: 'none',
            }}
          />
        ) : (
          <span
            onClick={() => setEditingTitle(true)}
            style={{
              flex: 1, fontSize: '12px', color: 'var(--text-primary)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              cursor: 'text',
            }}
            title="Click to edit title"
          >
            {subtask.title}
          </span>
        )}

        {/* Status chip — clicking 'running' or 'done' opens the session */}
        <span
          onClick={statusDot.clickable ? onOpenSession : undefined}
          style={{
            fontSize: '10px',
            color: statusDot.color,
            fontFamily: 'var(--font-mono)',
            flexShrink: 0,
            cursor: statusDot.clickable ? 'pointer' : 'default',
            ...(subtask.status === 'running' ? { animation: 'subtask-pulse 1.5s ease-in-out infinite' } : {}),
          }}
          title={statusDot.clickable ? 'Open session' : undefined}
        >
          {statusDot.label}
        </span>

        {/* Action buttons (visible on hover) */}
        {hovered && (
          <div style={{ display: 'flex', gap: 'var(--space-1)', flexShrink: 0 }}>
            {canLaunch && (
              <button
                onClick={onLaunch}
                title={blockerTooltip ?? 'Launch subtask'}
                style={{
                  background: 'none',
                  border: '1px solid var(--border-default)',
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                  fontSize: '10px',
                  padding: '2px 6px',
                  borderRadius: 'var(--radius-sm)',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                launch
              </button>
            )}
            {canRetry && (
              <button
                onClick={onRetry}
                title="Retry subtask (launch a new session)"
                style={{
                  background: 'none',
                  border: '1px solid var(--border-subtle)',
                  cursor: 'pointer',
                  color: 'var(--text-tertiary)',
                  fontSize: '10px',
                  padding: '2px 6px',
                  borderRadius: 'var(--radius-sm)',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                retry
              </button>
            )}
            <button
              onClick={onDelete}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-disabled)', fontSize: '11px', padding: '2px 4px',
              }}
              title="Delete subtask"
            >
              ×
            </button>
          </div>
        )}
      </div>

      {/* Expanded content */}
      {expanded && (
        <div style={{ marginTop: 'var(--space-2)', paddingLeft: 14 }}>
          <label style={{ display: 'block', fontSize: '10px', color: 'var(--text-disabled)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Prompt
          </label>
          <textarea
            value={promptValue}
            onChange={(e) => setPromptValue(e.target.value)}
            onBlur={handlePromptBlur}
            rows={3}
            placeholder={`Defaults to task title if empty…`}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              background: 'var(--bg-base)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-secondary)',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              padding: '4px 6px',
              resize: 'vertical',
              outline: 'none',
            }}
          />

          {/* Context deps */}
          {allSubtasks.filter((st) => st.id !== subtask.id).length > 0 && (
            <div style={{ marginTop: 'var(--space-2)' }}>
              <label style={{ display: 'block', fontSize: '10px', color: 'var(--text-disabled)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Depends on
              </label>
              {allSubtasks
                .filter((st) => st.id !== subtask.id)
                .map((st) => {
                  const checked = subtask.context_deps.includes(st.id);
                  return (
                    <div
                      key={st.id}
                      onClick={() => toggleDep(st.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: '11px',
                        color: checked ? 'var(--text-secondary)' : 'var(--text-tertiary)',
                        marginBottom: 2,
                        cursor: 'pointer',
                        padding: '1px 0',
                      }}
                    >
                      {/* Custom checkbox */}
                      <span
                        style={{
                          width: 12,
                          height: 12,
                          border: `1px solid ${checked ? 'var(--border-strong)' : 'var(--border-default)'}`,
                          borderRadius: 'var(--radius-sm)',
                          background: checked ? 'var(--bg-active)' : 'transparent',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          fontSize: '8px',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        {checked ? '✓' : ''}
                      </span>
                      {st.title}
                      {st.status !== 'pending' && (
                        <span style={{ marginLeft: 'auto', fontSize: '9px', color: 'var(--text-disabled)', fontFamily: 'var(--font-mono)' }}>
                          {st.status}
                        </span>
                      )}
                    </div>
                  );
                })}
            </div>
          )}

          {/* Deliverable (if done) */}
          {subtask.status === 'done' && subtask.deliverable && (
            <div style={{ marginTop: 'var(--space-2)' }}>
              <label style={{ display: 'block', fontSize: '10px', color: 'var(--text-disabled)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Deliverable
              </label>
              <div style={{
                fontSize: '11px',
                color: 'var(--text-tertiary)',
                fontFamily: 'var(--font-mono)',
                background: 'var(--bg-base)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                padding: '4px 6px',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}>
                {subtask.deliverable}
              </div>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes subtask-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
      `}</style>
    </div>
  );
}
