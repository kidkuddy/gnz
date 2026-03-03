import React from 'react';
import type { KanbanColumn as KanbanColumnType, KanbanCard as KanbanCardType } from '../../../lib/tauri-ipc';
import { useKanbanStore } from '../stores/kanban-store';
import { KanbanCard } from './KanbanCard';
import { toast } from 'sonner';

interface KanbanColumnProps {
  column: KanbanColumnType;
  cards: KanbanCardType[];
  workspaceId: string;
  boardId: string;
  onCardClick: (card: KanbanCardType) => void;
}

export function KanbanColumn({ column, cards, workspaceId, boardId, onCardClick }: KanbanColumnProps) {
  const moveCard = useKanbanStore((s) => s.moveCard);
  const createCard = useKanbanStore((s) => s.createCard);

  const [isDragOver, setIsDragOver] = React.useState(false);
  const [addingCard, setAddingCard] = React.useState(false);
  const [newCardTitle, setNewCardTitle] = React.useState('');
  const dragCounter = React.useRef(0);

  if (!column.visible) return null;

  const sortedCards = [...cards].sort((a, b) => a.position - b.position);

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragCounter.current += 1;
    setIsDragOver(true);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragLeave = (_e: React.DragEvent<HTMLDivElement>) => {
    dragCounter.current -= 1;
    if (dragCounter.current === 0) {
      setIsDragOver(false);
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragOver(false);

    const cardId = e.dataTransfer.getData('cardId') || e.dataTransfer.getData('text/plain');
    if (!cardId) return;

    // Don't move to same column if card is already there and we have no positional info
    // Compute drop position: append at end of target column
    const newPosition = sortedCards.length > 0
      ? sortedCards[sortedCards.length - 1].position + 1.0
      : 1.0;

    try {
      await moveCard(workspaceId, boardId, cardId, column.id, newPosition);
    } catch (err) {
      toast.error(`Failed to move card: ${err}`);
    }
  };

  const handleAddCard = async () => {
    if (!newCardTitle.trim()) return;
    try {
      await createCard(workspaceId, boardId, column.id, newCardTitle.trim());
      setNewCardTitle('');
      setAddingCard(false);
    } catch (err) {
      toast.error(`Failed to create card: ${err}`);
    }
  };

  return (
    <div
      style={{
        width: 272,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        background: isDragOver ? 'var(--bg-elevated)' : 'var(--bg-elevated)',
        border: `1px solid ${isDragOver ? 'var(--border-strong)' : 'var(--border-default)'}`,
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        maxHeight: '100%',
        transition: 'border-color 100ms ease',
        outline: isDragOver ? '1px solid var(--border-strong)' : 'none',
      }}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Column header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'var(--space-2) var(--space-3)',
          borderBottom: '1px solid var(--border-subtle)',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: '11px',
            fontWeight: 600,
            color: 'var(--text-tertiary)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {column.name}
        </span>
        <span
          style={{
            fontSize: '11px',
            color: 'var(--text-disabled)',
            fontFamily: 'var(--font-mono)',
            flexShrink: 0,
            marginLeft: 'var(--space-2)',
          }}
        >
          {sortedCards.length}
        </span>
      </div>

      {/* Cards area */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 'var(--space-2)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-2)',
          minHeight: 64,
        }}
      >
        {sortedCards.map((card) => (
          <KanbanCard
            key={card.id}
            card={card}
            onClick={() => onCardClick(card)}
          />
        ))}

        {sortedCards.length === 0 && (
          <div
            style={{
              fontSize: '11px',
              color: isDragOver ? 'var(--text-tertiary)' : 'var(--text-disabled)',
              textAlign: 'center',
              padding: 'var(--space-4) 0',
              transition: 'color 100ms ease',
            }}
          >
            {isDragOver ? 'Drop here' : 'Empty'}
          </div>
        )}
      </div>

      {/* Add card */}
      <div
        style={{
          padding: 'var(--space-2)',
          borderTop: '1px solid var(--border-subtle)',
          flexShrink: 0,
        }}
      >
        {addingCard ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
            <input
              autoFocus
              value={newCardTitle}
              onChange={(e) => setNewCardTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddCard();
                if (e.key === 'Escape') { setAddingCard(false); setNewCardTitle(''); }
              }}
              placeholder="Card title…"
              style={{
                background: 'var(--bg-base)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                fontSize: '12px',
                padding: '4px 8px',
                fontFamily: 'var(--font-sans)',
                outline: 'none',
                width: '100%',
                boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
              <button
                onClick={handleAddCard}
                style={{
                  flex: 1,
                  background: 'var(--bg-active)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-secondary)',
                  fontSize: '11px',
                  padding: '3px 0',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                Add
              </button>
              <button
                onClick={() => { setAddingCard(false); setNewCardTitle(''); }}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-disabled)',
                  fontSize: '14px',
                  padding: '3px 6px',
                }}
              >
                ×
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAddingCard(true)}
            style={{
              width: '100%',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-disabled)',
              fontSize: '11px',
              padding: '3px 0',
              textAlign: 'left',
              fontFamily: 'var(--font-sans)',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <span style={{ fontSize: '12px', lineHeight: 1 }}>+</span> Add card
          </button>
        )}
      </div>
    </div>
  );
}
