import React from 'react';
import { StickyNote, Plus, Trash2, FileText, FilePlus } from 'lucide-react';
import { useWorkspaceStore } from '../../../stores/workspace-store';
import { useTabStore } from '../../../stores/tab-store';
import { useScratchpadStore } from '../stores/scratchpad-store';
import { filesApi, type FileEntry } from '../../../lib/tauri-ipc';

type PanelMode = 'scratchpads' | 'markdown';

export function ScratchpadPanel() {
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace);
  const addTab = useTabStore((s) => s.addTab);
  const pads = useScratchpadStore((s) => s.pads);
  const loadedForWorkspace = useScratchpadStore((s) => s.loadedForWorkspace);
  const loadPads = useScratchpadStore((s) => s.loadPads);
  const createPad = useScratchpadStore((s) => s.createPad);
  const deletePad = useScratchpadStore((s) => s.deletePad);
  const setPadContent = useScratchpadStore((s) => s.setPadContent);

  const [hoveredId, setHoveredId] = React.useState<string | null>(null);
  const [mode, setMode] = React.useState<PanelMode>('scratchpads');
  const [mdFiles, setMdFiles] = React.useState<FileEntry[]>([]);
  const [mdLoading, setMdLoading] = React.useState(false);
  const [mdHovered, setMdHovered] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (activeWorkspace && loadedForWorkspace !== activeWorkspace.id) {
      loadPads(activeWorkspace.id);
    }
  }, [activeWorkspace, loadPads, loadedForWorkspace]);

  React.useEffect(() => {
    if (mode !== 'markdown' || !activeWorkspace) return;
    setMdLoading(true);
    filesApi
      .search(activeWorkspace.id, '.md')
      .then((files) => setMdFiles(files))
      .catch(() => setMdFiles([]))
      .finally(() => setMdLoading(false));
  }, [mode, activeWorkspace]);

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

  const handleOpenMdFile = (file: FileEntry) => {
    addTab({
      id: `md-file-${file.path}`,
      title: file.name,
      type: 'markdown-file',
      moduleId: 'scratchpad',
      data: { filePath: file.path },
    });
  };

  const handleAddAsScratchpad = async (e: React.MouseEvent, file: FileEntry) => {
    e.stopPropagation();
    if (!activeWorkspace) return;
    const name = file.name.replace(/\.md$/i, '');
    const pad = await createPad(activeWorkspace.id, name);
    try {
      const fc = await filesApi.read(activeWorkspace.id, file.path);
      setPadContent(pad.id, fc.content);
      // save immediately
      await useScratchpadStore.getState().savePad(activeWorkspace.id, pad.id);
    } catch {
      // pad created but content load failed — still open it
    }
    addTab({
      id: `scratchpad-${pad.id}`,
      title: pad.name,
      type: 'scratchpad',
      moduleId: 'scratchpad',
      data: { padId: pad.id },
    });
    setMode('scratchpads');
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
      {/* Mode toggle */}
      <div style={toggleRowStyle}>
        <button
          style={modeTabStyle(mode === 'scratchpads')}
          onClick={() => setMode('scratchpads')}
        >
          <StickyNote size={11} />
          Scratchpads
        </button>
        <button
          style={modeTabStyle(mode === 'markdown')}
          onClick={() => setMode('markdown')}
        >
          <FileText size={11} />
          Markdown Files
        </button>
      </div>

      {mode === 'scratchpads' && (
        <>
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
                  style={{ ...iconBtnStyle, opacity: hoveredId === pad.id ? 1 : 0 }}
                  title="Delete"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {mode === 'markdown' && (
        <div style={listStyle}>
          {mdLoading && <div style={emptyStyle}>Loading...</div>}
          {!mdLoading && mdFiles.length === 0 && (
            <div style={emptyStyle}>No markdown files found</div>
          )}
          {!mdLoading && mdFiles.map((file) => (
            <div
              key={file.path}
              style={rowStyle}
              onClick={() => handleOpenMdFile(file)}
              onMouseEnter={() => setMdHovered(file.path)}
              onMouseLeave={() => setMdHovered(null)}
              title={file.path}
            >
              <FileText size={13} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
              <span style={nameStyle}>{file.name}</span>
              {mdHovered === file.path && (
                <button
                  onClick={(e) => handleAddAsScratchpad(e, file)}
                  style={iconBtnStyle}
                  title="Add as scratchpad"
                >
                  <FilePlus size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const toggleRowStyle: React.CSSProperties = {
  display: 'flex',
  borderBottom: '1px solid var(--border-subtle)',
  flexShrink: 0,
};

function modeTabStyle(active: boolean): React.CSSProperties {
  return {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    padding: 'var(--space-2) var(--space-1)',
    background: 'none',
    border: 'none',
    borderBottom: active ? '2px solid var(--accent, #2dd4bf)' : '2px solid transparent',
    color: active ? 'var(--text-primary)' : 'var(--text-tertiary)',
    fontSize: '11px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'color 0.15s',
  };
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

const iconBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--text-disabled)',
  cursor: 'pointer',
  padding: '2px',
  display: 'flex',
  alignItems: 'center',
  flexShrink: 0,
};

const emptyStyle: React.CSSProperties = {
  fontSize: '11px',
  color: 'var(--text-disabled)',
  padding: 'var(--space-2)',
  textAlign: 'center',
};
