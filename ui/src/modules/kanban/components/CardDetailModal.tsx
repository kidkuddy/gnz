import React from 'react';
import type { KanbanCard, KanbanLabel } from '../../../lib/tauri-ipc';
import { useKanbanStore } from '../stores/kanban-store';
import { LabelPicker } from './LabelPicker';
import { SubtaskList } from './SubtaskList';
import { toast } from 'sonner';

interface CardDetailModalProps {
  card: KanbanCard;
  workspaceId: string;
  onClose: () => void;
}

const PRIORITIES: KanbanCard['priority'][] = ['would', 'could', 'should', 'must'];

export function CardDetailModal({ card, workspaceId, onClose }: CardDetailModalProps) {
  const updateCard = useKanbanStore((s) => s.updateCard);
  const deleteCard = useKanbanStore((s) => s.deleteCard);
  const attachLabel = useKanbanStore((s) => s.attachLabel);
  const detachLabel = useKanbanStore((s) => s.detachLabel);
  const loadSubtasks = useKanbanStore((s) => s.loadSubtasks);
  const subtasks = useKanbanStore((s) => s.subtasks[card.id]);
  const cards = useKanbanStore((s) => s.cards);

  // Keep local copy of card in sync with store changes
  const liveCard = cards.find((c) => c.id === card.id) ?? card;

  const [title, setTitle] = React.useState(liveCard.title);
  const [description, setDescription] = React.useState(liveCard.description);
  const titleDebounce = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const descDebounce = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    setTitle(liveCard.title);
    setDescription(liveCard.description);
  }, [liveCard.title, liveCard.description]);

  const saveTitle = (val: string) => {
    if (titleDebounce.current) clearTimeout(titleDebounce.current);
    titleDebounce.current = setTimeout(async () => {
      if (val !== liveCard.title) {
        try {
          await updateCard(workspaceId, liveCard.board_id, liveCard.id, { title: val });
        } catch (err) {
          toast.error(`Failed to update title: ${err}`);
        }
      }
    }, 500);
  };

  const saveDesc = (val: string) => {
    if (descDebounce.current) clearTimeout(descDebounce.current);
    descDebounce.current = setTimeout(async () => {
      if (val !== liveCard.description) {
        try {
          await updateCard(workspaceId, liveCard.board_id, liveCard.id, { description: val });
        } catch (err) {
          toast.error(`Failed to update description: ${err}`);
        }
      }
    }, 500);
  };

  const handlePriorityChange = async (priority: KanbanCard['priority']) => {
    try {
      await updateCard(workspaceId, liveCard.board_id, liveCard.id, { priority });
    } catch (err) {
      toast.error(`Failed to update priority: ${err}`);
    }
  };

  const handleAttachLabel = async (label: KanbanLabel) => {
    try {
      await attachLabel(workspaceId, liveCard.board_id, liveCard.id, label.id);
    } catch (err) {
      toast.error(`Failed to attach label: ${err}`);
    }
  };

  const handleDetachLabel = async (labelId: string) => {
    try {
      await detachLabel(workspaceId, liveCard.board_id, liveCard.id, labelId);
    } catch (err) {
      toast.error(`Failed to detach label: ${err}`);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteCard(workspaceId, liveCard.board_id, liveCard.id);
      onClose();
    } catch (err) {
      toast.error(`Failed to delete card: ${err}`);
    }
  };

  // Close on backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  // Close on Escape
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      onClick={handleBackdropClick}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-md)',
          width: '100%',
          maxWidth: 640,
          maxHeight: '80vh',
          overflowY: 'auto',
          padding: 'var(--space-5)',
          position: 'relative',
          boxSizing: 'border-box',
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 'var(--space-3)',
            right: 'var(--space-3)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-tertiary)',
            fontSize: '16px',
            lineHeight: 1,
            padding: '4px',
          }}
          title="Close"
        >
          ×
        </button>

        {/* Title */}
        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            saveTitle(e.target.value);
          }}
          onBlur={() => saveTitle(title)}
          style={{
            width: '100%',
            background: 'transparent',
            border: 'none',
            borderBottom: '1px solid var(--border-default)',
            color: 'var(--text-primary)',
            fontSize: '16px',
            fontFamily: 'var(--font-sans)',
            fontWeight: 600,
            padding: '0 0 var(--space-2) 0',
            marginBottom: 'var(--space-4)',
            outline: 'none',
            boxSizing: 'border-box',
            paddingRight: 32,
          }}
          placeholder="Card title"
        />

        {/* Priority */}
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <label style={{ display: 'block', fontSize: '10px', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 'var(--space-2)', fontWeight: 500 }}>
            Priority
          </label>
          <div style={{ display: 'flex', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', width: 'fit-content' }}>
            {PRIORITIES.map((p, i) => (
              <button
                key={p}
                onClick={() => handlePriorityChange(p)}
                style={{
                  background: liveCard.priority === p ? 'var(--bg-active)' : 'transparent',
                  border: 'none',
                  borderLeft: i > 0 ? '1px solid var(--border-subtle)' : 'none',
                  padding: '4px 12px',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  color: liveCard.priority === p ? 'var(--text-primary)' : 'var(--text-disabled)',
                  letterSpacing: '0.04em',
                  transition: 'background 80ms ease, color 80ms ease',
                }}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Description */}
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <label style={{ display: 'block', fontSize: '10px', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 'var(--space-2)', fontWeight: 500 }}>
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              saveDesc(e.target.value);
            }}
            onBlur={() => saveDesc(description)}
            rows={4}
            placeholder="Add a description…"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              background: 'var(--bg-base)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-primary)',
              fontSize: '13px',
              fontFamily: 'var(--font-sans)',
              padding: 'var(--space-2) var(--space-2)',
              resize: 'vertical',
              outline: 'none',
              lineHeight: 1.5,
            }}
          />
        </div>

        {/* Labels */}
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <label style={{ display: 'block', fontSize: '10px', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 'var(--space-2)', fontWeight: 500 }}>
            Labels
          </label>
          <LabelPicker
            boardId={liveCard.board_id}
            workspaceId={workspaceId}
            selectedLabels={liveCard.labels}
            onAttach={handleAttachLabel}
            onDetach={handleDetachLabel}
          />
        </div>

        {/* Subtasks */}
        <SubtaskList
          card={liveCard}
          workspaceId={workspaceId}
          subtasks={subtasks}
          onLoad={() => loadSubtasks(workspaceId, liveCard.id)}
        />

        {/* Delete button */}
        <div style={{ marginTop: 'var(--space-5)', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--border-subtle)' }}>
          <button
            onClick={handleDelete}
            style={{
              background: 'none',
              border: '1px solid var(--status-error)',
              borderRadius: 'var(--radius-sm)',
              color: '#e57373',
              fontSize: '12px',
              padding: '4px 12px',
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
            }}
          >
            Delete card
          </button>
        </div>
      </div>
    </div>
  );
}
