import React from 'react';
import { ChevronDown, Plus, Settings, FolderOpen } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import { useWorkspaceStore } from '../../stores/workspace-store';
import { useTabStore } from '../../stores/tab-store';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { SettingsView } from '../../modules/settings/views/SettingsView';
import { toast } from 'sonner';

const containerStyle: React.CSSProperties = {
  gridArea: 'titlebar',
  display: 'flex',
  alignItems: 'center',
  padding: '0 var(--space-4)',
  background: 'var(--bg-base)',
  height: 'var(--titlebar-height)',
  // @ts-expect-error WebkitAppRegion is a non-standard CSS property for Tauri drag regions
  WebkitAppRegion: 'drag',
  userSelect: 'none',
  gap: 'var(--space-3)',
};

const logoStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontWeight: 600,
  fontSize: '13px',
  color: 'var(--text-primary)',
  letterSpacing: '-0.02em',
};

const noDragStyle: React.CSSProperties = {
  // @ts-expect-error WebkitAppRegion is a non-standard CSS property
  WebkitAppRegion: 'no-drag',
};

const switcherBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  padding: '2px 8px',
  background: 'none',
  border: 'none',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text-tertiary)',
  fontSize: '12px',
  cursor: 'pointer',
  fontFamily: 'var(--font-sans)',
  transition: 'background 80ms ease',
};

const dropdownStyle: React.CSSProperties = {
  position: 'absolute',
  top: '100%',
  left: 0,
  marginTop: '4px',
  minWidth: '200px',
  background: '#0a0a0a',
  borderRadius: 'var(--radius-sm)',
  zIndex: 200,
  maxHeight: '240px',
  overflow: 'auto',
  padding: '4px 0',
};

const gearBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '24px',
  height: '24px',
  background: 'none',
  border: 'none',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text-disabled)',
  cursor: 'pointer',
  transition: 'color 80ms ease',
};

export function TitleBar() {
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace);
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const selectWorkspace = useWorkspaceStore((s) => s.selectWorkspace);
  const createWorkspace = useWorkspaceStore((s) => s.createWorkspace);
  const clearTabs = useTabStore((s) => s.clearTabs);

  const [dropdownOpen, setDropdownOpen] = React.useState(false);
  const [showCreate, setShowCreate] = React.useState(false);
  const [showSettings, setShowSettings] = React.useState(false);
  const [newName, setNewName] = React.useState('');
  const [newDesc, setNewDesc] = React.useState('');
  const [workingDir, setWorkingDir] = React.useState('');
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!dropdownOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [dropdownOpen]);

  const handleSwitch = (ws: typeof activeWorkspace) => {
    if (!ws) return;
    selectWorkspace(ws);
    clearTabs();
    setDropdownOpen(false);
  };

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
    } catch (err) {
      console.error('Folder dialog error:', err);
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
      clearTabs();
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
      <span style={logoStyle}>gnz</span>

      {activeWorkspace && (
        <div ref={dropdownRef} style={{ position: 'relative', ...noDragStyle }}>
          <button
            style={switcherBtnStyle}
            onClick={() => setDropdownOpen(!dropdownOpen)}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
          >
            {activeWorkspace.name}
            <ChevronDown size={11} style={{ opacity: 0.4 }} />
          </button>

          {dropdownOpen && (
            <div style={dropdownStyle}>
              {workspaces.map((ws) => (
                <WorkspaceOption
                  key={ws.id}
                  name={ws.name}
                  isActive={ws.id === activeWorkspace.id}
                  onSelect={() => handleSwitch(ws)}
                />
              ))}
              <div style={{ borderTop: '1px solid var(--border-subtle)', margin: '4px 0' }} />
              <button
                onClick={() => { setDropdownOpen(false); setShowCreate(true); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  width: '100%',
                  padding: '6px 10px',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-tertiary)',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
              >
                <Plus size={12} />
                New Workspace
              </button>
            </div>
          )}
        </div>
      )}

      <div style={{ flex: 1 }} />

      <div style={noDragStyle}>
        <button
          style={gearBtnStyle}
          onClick={() => setShowSettings(true)}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-disabled)'; }}
          title="Settings"
        >
          <Settings size={14} />
        </button>
      </div>

      {/* Create workspace modal */}
      <Modal open={showCreate} onOpenChange={setShowCreate} title="Create Workspace" description="Workspaces organize your connections, queries, and Claude sessions.">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <Input label="Name" placeholder="My Project" value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus />
          <Input label="Description" placeholder="Optional description" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
            <label style={{ fontSize: '12px', fontWeight: 400, color: 'var(--text-secondary)', letterSpacing: '0.02em' }}>
              Project Folder
            </label>
            <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
              <div style={{
                flex: 1, height: '30px', display: 'flex', alignItems: 'center', padding: '0 var(--space-3)',
                background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)', fontSize: '12px',
                fontFamily: 'var(--font-mono)', color: workingDir ? 'var(--text-primary)' : 'var(--text-disabled)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {workingDir || 'No folder selected'}
              </div>
              <Button variant="secondary" size="sm" onClick={handleBrowse}>
                <FolderOpen size={13} />
                Browse
              </Button>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
            <Button variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleCreate} disabled={!newName.trim()}>Create</Button>
          </div>
        </div>
      </Modal>

      {/* Settings modal */}
      <Modal open={showSettings} onOpenChange={setShowSettings} title="Settings">
        <SettingsView />
      </Modal>
    </div>
  );
}

function WorkspaceOption({ name, isActive, onSelect }: { name: string; isActive: boolean; onSelect: () => void }) {
  const [hovered, setHovered] = React.useState(false);

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '6px 10px',
        cursor: 'pointer',
        background: isActive ? 'var(--accent-muted)' : hovered ? 'var(--bg-hover)' : 'transparent',
        fontSize: '12px',
        color: 'var(--text-primary)',
      }}
    >
      {name}
    </div>
  );
}
