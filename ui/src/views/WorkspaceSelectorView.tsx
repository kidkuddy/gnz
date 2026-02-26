import React from 'react';
import { Plus, Trash2, FolderOpen } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { useWorkspaceStore } from '../stores/workspace-store';
import { parseWorkspaceSettings } from '../lib/tauri-ipc';
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
  fontWeight: 600,
  fontSize: '28px',
  color: 'var(--text-primary)',
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
  const [workingDir, setWorkingDir] = React.useState('');

  const handleBrowse = async () => {
    try {
      const selected = await open({ directory: true, multiple: false, title: 'Select project folder' });
      if (selected) {
        setWorkingDir(selected as string);
        if (!newName.trim()) {
          const parts = (selected as string).replace(/\/$/, '').split('/');
          setNewName(parts[parts.length - 1] || '');
        }
      }
    } catch {
      // User cancelled
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      const settings = JSON.stringify({ working_directory: workingDir || undefined });
      const ws = await createWorkspace({
        name: newName.trim(),
        description: newDesc.trim() || undefined,
        settings,
      });
      selectWorkspace(ws);
      setShowCreate(false);
      setNewName('');
      setNewDesc('');
      setWorkingDir('');
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
        description="Workspaces organize your connections, queries, and Claude sessions."
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
            <label style={{ fontSize: '12px', fontWeight: 400, color: 'var(--text-secondary)', letterSpacing: '0.02em' }}>
              Project Folder
            </label>
            <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
              <div
                style={{
                  flex: 1,
                  height: '30px',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 var(--space-3)',
                  background: 'var(--bg-elevated)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '12px',
                  fontFamily: 'var(--font-mono)',
                  color: workingDir ? 'var(--text-primary)' : 'var(--text-disabled)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {workingDir || 'No folder selected'}
              </div>
              <Button variant="secondary" size="sm" onClick={handleBrowse}>
                <FolderOpen size={13} />
                Browse
              </Button>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
              Claude sessions will use this as their working directory.
            </span>
          </div>
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
  const settings = parseWorkspaceSettings(workspace.settings);

  const cardStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-2)',
    padding: 'var(--space-4)',
    background: hovered ? 'var(--bg-hover)' : 'var(--bg-elevated)',
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
    transition: 'background 100ms ease',
    position: 'relative',
  };

  const nameStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-2)',
    fontSize: '14px',
    fontWeight: 500,
    color: 'var(--text-primary)',
  };

  const descStyle: React.CSSProperties = {
    fontSize: '12px',
    color: 'var(--text-tertiary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  };

  const pathStyle: React.CSSProperties = {
    fontSize: '11px',
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-disabled)',
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
        <FolderOpen size={16} color="var(--text-tertiary)" />
        {workspace.name}
      </div>
      {workspace.description && <div style={descStyle}>{workspace.description}</div>}
      {settings.working_directory && <div style={pathStyle}>{settings.working_directory}</div>}
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
