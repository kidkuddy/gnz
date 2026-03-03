import React from 'react';
import { useKanbanStore } from '../stores/kanban-store';
import { KanbanColumn } from './KanbanColumn';
import { CardDetailModal } from './CardDetailModal';
import type { KanbanCard } from '../../../lib/tauri-ipc';

interface KanbanBoardProps {
  boardId: string;
  workspaceId: string;
}

export function KanbanBoard({ boardId, workspaceId }: KanbanBoardProps) {
  const loadBoard = useKanbanStore((s) => s.loadBoard);
  const columns = useKanbanStore((s) => s.columns);
  const cards = useKanbanStore((s) => s.cards);
  const loading = useKanbanStore((s) => s.loading);
  const selectedCardId = useKanbanStore((s) => s.selectedCardId);
  const selectCard = useKanbanStore((s) => s.selectCard);

  React.useEffect(() => {
    if (boardId && workspaceId) {
      loadBoard(workspaceId, boardId);
    }
  }, [boardId, workspaceId, loadBoard]);

  const selectedCard = cards.find((c) => c.id === selectedCardId) ?? null;

  const handleCardClick = (card: KanbanCard) => {
    selectCard(card.id);
  };

  const handleCloseModal = () => {
    selectCard(null);
  };

  const boardColumns = columns.filter((col) => col.board_id === boardId);
  const boardCards = cards.filter((c) => c.board_id === boardId);

  if (loading && boardColumns.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: 'var(--text-disabled)',
          fontSize: '13px',
          fontFamily: 'var(--font-sans)',
        }}
      >
        Loading board…
      </div>
    );
  }

  if (boardColumns.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: 'var(--text-disabled)',
          fontSize: '13px',
          fontFamily: 'var(--font-sans)',
        }}
      >
        No columns yet. Add columns from the sidebar.
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        gap: 'var(--space-3)',
        padding: 'var(--space-4)',
        height: '100%',
        overflowX: 'auto',
        overflowY: 'hidden',
        boxSizing: 'border-box',
        alignItems: 'flex-start',
      }}
    >
      {boardColumns
        .filter((col) => col.visible)
        .sort((a, b) => a.position - b.position)
        .map((column) => (
          <KanbanColumn
            key={column.id}
            column={column}
            cards={boardCards.filter((c) => c.column_id === column.id)}
            workspaceId={workspaceId}
            boardId={boardId}
            onCardClick={handleCardClick}
          />
        ))}

      {selectedCard && (
        <CardDetailModal
          card={selectedCard}
          workspaceId={workspaceId}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
}
