import React from 'react';
import { StickyNote } from 'lucide-react';
import { useWorkspaceStore } from '../../../stores/workspace-store';
import { useTabStore } from '../../../stores/tab-store';

export function ScratchpadPanel() {
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace);
  const addTab = useTabStore((s) => s.addTab);

  const handleOpen = () => {
    if (!activeWorkspace) return;
    addTab({
      id: `scratchpad-${activeWorkspace.id}`,
      title: 'Scratchpad',
      type: 'scratchpad',
      moduleId: 'scratchpad',
      data: {},
    });
  };

  if (!activeWorkspace) {
    return (
      <div style={{ padding: 'var(--space-4)', color: 'var(--text-disabled)', fontSize: '12px' }}>
        Select a workspace first
      </div>
    );
  }

  return (
    <div style={{ padding: 'var(--space-3)' }}>
      <button onClick={handleOpen} style={openButtonStyle}>
        <StickyNote size={14} />
        <span>Open Scratchpad</span>
      </button>
      <div style={hintStyle}>
        Notes and todos for this workspace. Auto-saves as you type.
      </div>
    </div>
  );
}

const openButtonStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
  width: '100%',
  padding: 'var(--space-2) var(--space-3)',
  background: 'var(--bg-elevated)',
  color: 'var(--text-secondary)',
  border: 'none',
  borderRadius: 'var(--radius-sm)',
  cursor: 'pointer',
  fontSize: '12px',
  fontFamily: 'inherit',
  textAlign: 'left',
};

const hintStyle: React.CSSProperties = {
  fontSize: '11px',
  color: 'var(--text-disabled)',
  marginTop: 'var(--space-2)',
  lineHeight: '1.4',
};
