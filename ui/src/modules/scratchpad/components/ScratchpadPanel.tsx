import React from 'react';
import { StickyNote, Plus, Trash2 } from 'lucide-react';
import { useWorkspaceStore } from '../../../stores/workspace-store';
import { useTabStore } from '../../../stores/tab-store';
import { useScratchpadStore } from '../stores/scratchpad-store';

export function ScratchpadPanel() {
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace);
  const addTab = useTabStore((s) => s.addTab);
  const pads = useScratchpadStore((s) => s.pads);
  const loadedForWorkspace = useScratchpadStore((s) => s.loadedForWorkspace);
  const loadPads = useScratchpadStore((s) => s.loadPads);
  const createPad = useScratchpadStore((s) => s.createPad);
  const deletePad = useScratchpadStore((s) => s.deletePad);
  const [hoveredId, setHoveredId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (activeWorkspace && loadedForWorkspace !== activeWorkspace.id) {
      loadPads(activeWorkspace.id);
    }
  }, [activeWorkspace, loadPads, loadedForWorkspace]);

  const handleOpen = (padId: string, padName: string) => {
    addTab({
      id: `scratchpad-${padId}`,
      title: padName,
      type: 'scratchpad',
      moduleId: 'scratchpad',
      data: { padId },
    });
  };

  const handleCreate = async () => {
    if (!activeWorkspace) return;
    const pad = await createPad(activeWorkspace.id, 'Scratchpad');
    handleOpen(pad.id, pad.name);
  };

  const handleDelete = async (e: React.MouseEvent, padId: string) => {
    e.stopPropagation();
    if (!activeWorkspace) return;
    await deletePad(activeWorkspace.id, padId);
  };

  if (!activeWorkspace) {
    return (
      <div style={{ padding: 'var(--space-4)', color: 'var(--text-disabled)', fontSize: '12px' }}>
        Select a workspace first
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={headerStyle}>
        <button onClick={handleCreate} style={newButtonStyle} title="New scratchpad">
          <Plus size={13} />
          <span>New</span>
        </button>
      </div>
      <div style={listStyle}>
        {pads.length === 0 && (
          <div style={emptyStyle}>No scratchpads yet</div>
        )}
        {pads.map((pad) => (
          <div
            key={pad.id}
            style={rowStyle}
            onClick={() => handleOpen(pad.id, pad.name)}
            onMouseEnter={() => setHoveredId(pad.id)}
            onMouseLeave={() => setHoveredId(null)}
          >
            <StickyNote size={13} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
            <span style={nameStyle}>{pad.name}</span>
            <button
              onClick={(e) => handleDelete(e, pad.id)}
              style={{ ...deleteButtonStyle, opacity: hoveredId === pad.id ? 1 : 0 }}
              title="Delete"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

const headerStyle: React.CSSProperties = {
  padding: 'var(--space-2) var(--space-3)',
  borderBottom: '1px solid var(--border-subtle)',
  flexShrink: 0,
};

const newButtonStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-1)',
  padding: 'var(--space-1) var(--space-2)',
  background: 'var(--bg-elevated)',
  color: 'var(--text-secondary)',
  border: 'none',
  borderRadius: 'var(--radius-sm)',
  cursor: 'pointer',
  fontSize: '12px',
  fontFamily: 'inherit',
};

const listStyle: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: 'var(--space-2)',
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
};

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
  padding: 'var(--space-2) var(--space-2)',
  borderRadius: 'var(--radius-sm)',
  cursor: 'pointer',
  fontSize: '12px',
  color: 'var(--text-secondary)',
};

const nameStyle: React.CSSProperties = {
  flex: 1,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const deleteButtonStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--text-disabled)',
  cursor: 'pointer',
  padding: '2px',
  display: 'flex',
  alignItems: 'center',
  flexShrink: 0,
  opacity: 0,
};

const emptyStyle: React.CSSProperties = {
  fontSize: '11px',
  color: 'var(--text-disabled)',
  padding: 'var(--space-2)',
  textAlign: 'center',
};
