import React from 'react';
import { Plus, Trash2, FolderOpen } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { useWorkspaceStore } from '../stores/workspace-store';
import { toast } from 'sonner';
import type { Workspace } from '../lib/tauri-ipc';

const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100vh',
  width: '100vw',
  background: 'var(--bg-base)',
  padding: 'var(--space-8)',
};

const logoStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontWeight: 700,
  fontSize: '28px',
  color: 'var(--accent-text)',
  letterSpacing: '-0.04em',
  marginBottom: 'var(--space-1)',
};

const subtitleStyle: React.CSSProperties = {
  fontSize: '13px',
  color: 'var(--text-tertiary)',
  marginBottom: 'var(--space-8)',
};

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
  gap: 'var(--space-3)',
  width: '100%',
  maxWidth: '640px',
  marginBottom: 'var(--space-6)',
};

const createBtnRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
};

export function WorkspaceSelectorView() {
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const selectWorkspace = useWorkspaceStore((s) => s.selectWorkspace);
  const createWorkspace = useWorkspaceStore((s) => s.createWorkspace);
  const deleteWorkspace = useWorkspaceStore((s) => s.deleteWorkspace);
  const [showCreate, setShowCreate] = React.useState(false);
  const [newName, setNewName] = React.useState('');
  const [newDesc, setNewDesc] = React.useState('');

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      const ws = await createWorkspace({ name: newName.trim(), description: newDesc.trim() || undefined });
      selectWorkspace(ws);
      setShowCreate(false);
      setNewName('');
      setNewDesc('');
    } catch (err) {
      toast.error(`Failed to create workspace: ${err}`);
    }
  };

  return (
    <div style={containerStyle}>
      <div style={logoStyle}>gnz</div>
      <div style={subtitleStyle}>Select a workspace to continue</div>

      {workspaces.length > 0 && (
        <div style={gridStyle}>
          {workspaces.map((ws) => (
            <WorkspaceCard
              key={ws.id}
              workspace={ws}
              onSelect={() => selectWorkspace(ws)}
              onDelete={() => {
                deleteWorkspace(ws.id).catch((err) => toast.error(`Failed: ${err}`));
              }}
            />
          ))}
        </div>
      )}

      <div style={createBtnRowStyle}>
        <Button variant="primary" onClick={() => setShowCreate(true)}>
          <Plus size={14} />
          New Workspace
        </Button>
      </div>

      <Modal
        open={showCreate}
        onOpenChange={setShowCreate}
        title="Create Workspace"
        description="Workspaces organize your database connections and queries."
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <Input
            label="Name"
            placeholder="My Project"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            autoFocus
          />
          <Input
            label="Description"
            placeholder="Optional description"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
            <Button variant="secondary" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleCreate} disabled={!newName.trim()}>
              Create
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function WorkspaceCard({
  workspace,
  onSelect,
  onDelete,
}: {
  workspace: Workspace;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const [hovered, setHovered] = React.useState(false);

  const cardStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-2)',
    padding: 'var(--space-4)',
    background: hovered ? 'var(--bg-hover)' : 'var(--bg-surface)',
    border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-lg)',
    cursor: 'pointer',
    transition: 'all 120ms ease',
    position: 'relative',
  };

  const nameStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-2)',
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--text-primary)',
  };

  const descStyle: React.CSSProperties = {
    fontSize: '12px',
    color: 'var(--text-tertiary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  };

  const deleteBtnStyle: React.CSSProperties = {
    position: 'absolute',
    top: 'var(--space-2)',
    right: 'var(--space-2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '24px',
    height: '24px',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-disabled)',
    opacity: hovered ? 1 : 0,
    transition: 'opacity 80ms ease',
  };

  return (
    <div
      style={cardStyle}
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={nameStyle}>
        <FolderOpen size={16} color="var(--accent-text)" />
        {workspace.name}
      </div>
      {workspace.description && <div style={descStyle}>{workspace.description}</div>}
      <button
        style={deleteBtnStyle}
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        title="Delete workspace"
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}
