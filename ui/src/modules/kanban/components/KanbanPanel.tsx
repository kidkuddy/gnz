import React from 'react';
import { PanelSection } from '../../../components/layout/Panel';
import { useWorkspaceStore } from '../../../stores/workspace-store';
import { useTabStore } from '../../../stores/tab-store';
import { useKanbanStore } from '../stores/kanban-store';
import { toast } from 'sonner';

export function KanbanPanel() {
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace);
  const boards = useKanbanStore((s) => s.boards);
  const activeBoard = useKanbanStore((s) => s.activeBoard);
  const columns = useKanbanStore((s) => s.columns);
  const loadBoards = useKanbanStore((s) => s.loadBoards);
  const setActiveBoard = useKanbanStore((s) => s.setActiveBoard);
  const toggleColumnVisibility = useKanbanStore((s) => s.toggleColumnVisibility);
  const createColumn = useKanbanStore((s) => s.createColumn);
  const deleteColumn = useKanbanStore((s) => s.deleteColumn);
  const addTab = useTabStore((s) => s.addTab);

  const [addingColumn, setAddingColumn] = React.useState(false);
  const [newColName, setNewColName] = React.useState('');

  React.useEffect(() => {
    if (activeWorkspace) {
      loadBoards(activeWorkspace.id).catch(() => {});
    }
  }, [activeWorkspace, loadBoards]);

  if (!activeWorkspace) {
    return (
      <div style={{ padding: 'var(--space-4)', color: 'var(--text-disabled)', fontSize: '12px' }}>
        Select a workspace first
      </div>
    );
  }

  const handleBoardClick = (boardId: string, boardName: string, board: typeof boards[number]) => {
    setActiveBoard(board);
    addTab({
      id: `kanban-board-${boardId}`,
      title: boardName,
      type: 'kanban-board',
      moduleId: 'kanban',
      data: { boardId, workspaceId: activeWorkspace.id },
    });
  };

  const handleToggleColumn = async (colId: string, visible: boolean) => {
    if (!activeBoard) return;
    try {
      await toggleColumnVisibility(activeWorkspace.id, activeBoard.id, colId, visible);
    } catch (err) {
      toast.error(`Failed to toggle column: ${err}`);
    }
  };

  const handleAddColumn = async () => {
    if (!newColName.trim() || !activeBoard) return;
    try {
      await createColumn(activeWorkspace.id, activeBoard.id, newColName.trim());
      setNewColName('');
      setAddingColumn(false);
    } catch (err) {
      toast.error(`Failed to create column: ${err}`);
    }
  };

  const handleDeleteColumn = async (colId: string, colName: string) => {
    if (!activeBoard) return;
    if (!confirm(`Delete column "${colName}"? Cards will be moved to the first remaining column.`)) return;
    try {
      await deleteColumn(activeWorkspace.id, activeBoard.id, colId);
    } catch (err) {
      toast.error(`Failed to delete column: ${err}`);
    }
  };

  const activeBoardColumns = activeBoard
    ? columns.filter((c) => c.board_id === activeBoard.id).sort((a, b) => a.position - b.position)
    : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* Boards section */}
      <PanelSection title="Boards">
        {boards.length === 0 ? (
          <div style={{ padding: 'var(--space-2) var(--space-3)', fontSize: '11px', color: 'var(--text-disabled)' }}>
            No boards
          </div>
        ) : (
          boards.map((board) => {
            const isActive = activeBoard?.id === board.id;
            return (
              <div
                key={board.id}
                onClick={() => handleBoardClick(board.id, board.name, board)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  padding: '5px var(--space-3)',
                  fontSize: '12px',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-tertiary)',
                  background: isActive ? 'var(--bg-active)' : 'transparent',
                  borderLeft: `2px solid ${isActive ? 'var(--border-strong)' : 'transparent'}`,
                  cursor: 'pointer',
                  userSelect: 'none',
                  transition: 'background 80ms ease',
                }}
              >
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {board.name}
                </span>
              </div>
            );
          })
        )}
      </PanelSection>

      {/* Columns section — only if a board is active */}
      {activeBoard && (
        <div style={{ borderTop: '1px solid var(--border-subtle)', flex: 1, overflowY: 'auto', minHeight: 0 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 'var(--space-2) var(--space-3)',
          }}>
            <span style={{
              fontSize: '10px',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--text-disabled)',
              fontWeight: 500,
            }}>
              Columns
            </span>
            <button
              onClick={() => setAddingColumn((v) => !v)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-tertiary)',
                fontSize: '13px',
                lineHeight: 1,
                padding: '0 2px',
              }}
              title="Add column"
            >
              +
            </button>
          </div>

          {addingColumn && (
            <div style={{ padding: '0 var(--space-3) var(--space-2)', display: 'flex', gap: 'var(--space-1)' }}>
              <input
                autoFocus
                value={newColName}
                onChange={(e) => setNewColName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddColumn();
                  if (e.key === 'Escape') { setAddingColumn(false); setNewColName(''); }
                }}
                placeholder="Column name…"
                style={{
                  flex: 1,
                  background: 'var(--bg-base)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)',
                  fontSize: '11px',
                  padding: '3px 6px',
                  fontFamily: 'var(--font-sans)',
                  outline: 'none',
                }}
              />
              <button
                onClick={handleAddColumn}
                style={{
                  background: 'var(--bg-active)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-secondary)',
                  fontSize: '11px',
                  padding: '3px 8px',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                Add
              </button>
            </div>
          )}

          {activeBoardColumns.map((col) => (
            <ColumnRow
              key={col.id}
              name={col.name}
              visible={col.visible}
              onToggle={(v) => handleToggleColumn(col.id, v)}
              onDelete={() => handleDeleteColumn(col.id, col.name)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface ColumnRowProps {
  name: string;
  visible: boolean;
  onToggle: (v: boolean) => void;
  onDelete: () => void;
}

function ColumnRow({ name, visible, onToggle, onDelete }: ColumnRowProps) {
  const [hovered, setHovered] = React.useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        padding: '4px var(--space-3)',
        fontSize: '12px',
        color: visible ? 'var(--text-secondary)' : 'var(--text-disabled)',
      }}
    >
      {/* Custom toggle */}
      <button
        onClick={() => onToggle(!visible)}
        title={visible ? 'Hide column' : 'Show column'}
        style={{
          flexShrink: 0,
          width: 24,
          height: 12,
          borderRadius: 6,
          background: visible ? 'var(--bg-active)' : 'transparent',
          border: `1px solid ${visible ? 'var(--border-strong)' : 'var(--border-default)'}`,
          cursor: 'pointer',
          position: 'relative',
          padding: 0,
          transition: 'background 100ms ease, border-color 100ms ease',
        }}
      >
        <span style={{
          display: 'block',
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: visible ? 'var(--text-secondary)' : 'var(--text-disabled)',
          position: 'absolute',
          top: 1,
          left: visible ? 13 : 1,
          transition: 'left 100ms ease, background 100ms ease',
        }} />
      </button>

      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {name}
      </span>

      {hovered && (
        <button
          onClick={onDelete}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-disabled)',
            fontSize: '12px',
            padding: 0,
            lineHeight: 1,
            flexShrink: 0,
          }}
          title="Delete column"
        >
          ×
        </button>
      )}
    </div>
  );
}
