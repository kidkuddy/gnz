import React from 'react';
import { File, Folder, FolderOpen, ChevronRight, ChevronDown, Loader2, Plus, RefreshCw } from 'lucide-react';
import { PanelSection } from '../../../components/layout/Panel';
import { useWorkspaceStore } from '../../../stores/workspace-store';
import { useTabStore } from '../../../stores/tab-store';
import { useSearchStore } from '../stores/search-store';
import type { TreeEntry } from '../../../lib/tauri-ipc';

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: '28px',
  padding: '0 var(--space-3)',
  background: 'var(--bg-elevated)',
  border: 'none',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text-primary)',
  fontSize: '12px',
  fontFamily: 'var(--font-mono)',
  outline: 'none',
};

const inlineInputStyle: React.CSSProperties = {
  width: '100%',
  height: '22px',
  padding: '0 4px',
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-active)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text-primary)',
  fontSize: '12px',
  fontFamily: 'var(--font-mono)',
  outline: 'none',
};

const contextMenuStyle: React.CSSProperties = {
  position: 'fixed',
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-sm)',
  padding: '4px 0',
  zIndex: 9999,
  minWidth: '120px',
  boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
};

const contextMenuItemStyle: React.CSSProperties = {
  padding: '6px 12px',
  fontSize: '12px',
  cursor: 'pointer',
  color: 'var(--text-primary)',
};

interface ContextMenu {
  x: number;
  y: number;
  path: string;
  isDir: boolean;
}

export function SearchPanel() {
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace);
  const addTab = useTabStore((s) => s.addTab);
  const query = useSearchStore((s) => s.query);
  const results = useSearchStore((s) => s.results);
  const loading = useSearchStore((s) => s.loading);
  const setQuery = useSearchStore((s) => s.setQuery);
  const search = useSearchStore((s) => s.search);
  const tree = useSearchStore((s) => s.tree);
  const treeLoading = useSearchStore((s) => s.treeLoading);
  const fetchTree = useSearchStore((s) => s.fetchTree);
  const createFile = useSearchStore((s) => s.createFile);
  const deleteFile = useSearchStore((s) => s.deleteFile);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [newFileInput, setNewFileInput] = React.useState<{ parentPath: string | null } | null>(null);
  const [newFileName, setNewFileName] = React.useState('');
  const [contextMenu, setContextMenu] = React.useState<ContextMenu | null>(null);

  React.useEffect(() => {
    if (activeWorkspace && tree.length === 0) {
      fetchTree(activeWorkspace.id);
    }
  }, [activeWorkspace?.id]);

  React.useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [contextMenu]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!val.trim()) {
      if (activeWorkspace) search(activeWorkspace.id, '');
    } else if (activeWorkspace) {
      timerRef.current = setTimeout(() => {
        search(activeWorkspace.id, val);
      }, 300);
    }
  };

  const handleSelectFile = (path: string, name: string) => {
    addTab({
      id: `file-${path}`,
      title: name,
      type: 'file-viewer',
      moduleId: 'search',
      data: { filePath: path },
    });
  };

  const handleNewFile = (parentPath: string | null) => {
    setNewFileInput({ parentPath });
    setNewFileName('');
  };

  const handleNewFileSubmit = async () => {
    if (!activeWorkspace || !newFileName.trim()) {
      setNewFileInput(null);
      return;
    }
    const fullPath = newFileInput?.parentPath
      ? `${newFileInput.parentPath}/${newFileName.trim()}`
      : newFileName.trim();
    try {
      await createFile(activeWorkspace.id, fullPath);
      const name = fullPath.split('/').pop() || fullPath;
      if (!name.includes('/')) {
        handleSelectFile(fullPath, name);
      }
    } catch {
      // ignore
    }
    setNewFileInput(null);
  };

  const handleContextMenu = (e: React.MouseEvent, path: string, isDir: boolean) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, path, isDir });
  };

  const handleDelete = async () => {
    if (!activeWorkspace || !contextMenu) return;
    try {
      await deleteFile(activeWorkspace.id, contextMenu.path);
    } catch {
      // ignore
    }
    setContextMenu(null);
  };

  const handleContextNewFile = () => {
    if (!contextMenu) return;
    if (contextMenu.isDir) {
      const toggleDir = useSearchStore.getState().toggleDir;
      const expanded = useSearchStore.getState().expandedDirs;
      if (!expanded.has(contextMenu.path)) toggleDir(contextMenu.path);
      handleNewFile(contextMenu.path);
    } else {
      const parent = contextMenu.path.includes('/')
        ? contextMenu.path.substring(0, contextMenu.path.lastIndexOf('/'))
        : null;
      handleNewFile(parent);
    }
    setContextMenu(null);
  };

  if (!activeWorkspace) {
    return (
      <div style={{ padding: 'var(--space-4)', color: 'var(--text-disabled)', fontSize: '12px' }}>
        Select a workspace first
      </div>
    );
  }

  const hasQuery = query.trim().length > 0;

  return (
    <>
      <div style={{ padding: 'var(--space-3)' }}>
        <input
          style={inputStyle}
          type="text"
          placeholder="Search files..."
          value={query}
          onChange={handleChange}
          autoFocus
        />
      </div>

      {hasQuery ? (
        <PanelSection title={loading ? 'Searching...' : results.length > 0 ? `Results (${results.length})` : 'Results'}>
          {loading && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-4)' }}>
              <Loader2 size={14} style={{ animation: 'spin 1s linear infinite', color: 'var(--text-disabled)' }} />
            </div>
          )}
          {!loading && results.length === 0 && (
            <div style={{ padding: 'var(--space-3)', color: 'var(--text-disabled)', fontSize: '12px' }}>
              No files found
            </div>
          )}
          {!loading && results.map((file) => (
            <FileResult
              key={file.path}
              path={file.path}
              name={file.name}
              size={file.size}
              onClick={() => handleSelectFile(file.path, file.name)}
            />
          ))}
        </PanelSection>
      ) : (
        <PanelSection
          title={treeLoading ? 'Loading...' : 'Explorer'}
          action={
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                onClick={() => activeWorkspace && fetchTree(activeWorkspace.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: '2px', display: 'flex' }}
                title="Refresh"
              >
                <RefreshCw size={13} />
              </button>
              <button
                onClick={() => handleNewFile(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: '2px', display: 'flex' }}
                title="New file"
              >
                <Plus size={14} />
              </button>
            </div>
          }
        >
          {treeLoading && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-4)' }}>
              <Loader2 size={14} style={{ animation: 'spin 1s linear infinite', color: 'var(--text-disabled)' }} />
            </div>
          )}
          {!treeLoading && tree.length === 0 && !newFileInput && (
            <div style={{ padding: 'var(--space-3)', color: 'var(--text-disabled)', fontSize: '12px' }}>
              No files in workspace
            </div>
          )}
          {newFileInput && newFileInput.parentPath === null && (
            <NewFileInlineInput
              depth={0}
              value={newFileName}
              onChange={setNewFileName}
              onSubmit={handleNewFileSubmit}
              onCancel={() => setNewFileInput(null)}
            />
          )}
          {!treeLoading && tree.map((entry) => (
            <TreeNode
              key={entry.path}
              entry={entry}
              depth={0}
              onFileClick={handleSelectFile}
              onContextMenu={handleContextMenu}
              wsId={activeWorkspace.id}
              newFileInput={newFileInput}
              newFileName={newFileName}
              onNewFileNameChange={setNewFileName}
              onNewFileSubmit={handleNewFileSubmit}
              onNewFileCancel={() => setNewFileInput(null)}
            />
          ))}
        </PanelSection>
      )}

      {contextMenu && (
        <div style={{ ...contextMenuStyle, left: contextMenu.x, top: contextMenu.y }}>
          <ContextMenuItem label="New File" onClick={handleContextNewFile} />
          <ContextMenuItem label="Delete" onClick={handleDelete} danger />
        </div>
      )}
    </>
  );
}

function ContextMenuItem({ label, onClick, danger }: { label: string; onClick: () => void; danger?: boolean }) {
  const [hovered, setHovered] = React.useState(false);
  return (
    <div
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...contextMenuItemStyle,
        background: hovered ? 'var(--bg-hover)' : 'transparent',
        color: danger ? '#e55' : 'var(--text-primary)',
      }}
    >
      {label}
    </div>
  );
}

function NewFileInlineInput({ depth, value, onChange, onSubmit, onCancel }: {
  depth: number; value: string; onChange: (v: string) => void; onSubmit: () => void; onCancel: () => void;
}) {
  const ref = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => { ref.current?.focus(); }, []);
  const paddingLeft = 8 + depth * 16 + 16;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: `2px var(--space-2) 2px ${paddingLeft}px` }}>
      <File size={12} style={{ flexShrink: 0, color: 'var(--text-disabled)' }} />
      <input
        ref={ref}
        style={inlineInputStyle}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') onSubmit(); if (e.key === 'Escape') onCancel(); }}
        onBlur={onSubmit}
        placeholder="filename..."
      />
    </div>
  );
}

interface TreeNodeProps {
  entry: TreeEntry;
  depth: number;
  onFileClick: (path: string, name: string) => void;
  onContextMenu: (e: React.MouseEvent, path: string, isDir: boolean) => void;
  wsId: string;
  newFileInput: { parentPath: string | null } | null;
  newFileName: string;
  onNewFileNameChange: (v: string) => void;
  onNewFileSubmit: () => void;
  onNewFileCancel: () => void;
}

function TreeNode({ entry, depth, onFileClick, onContextMenu, wsId, newFileInput, newFileName, onNewFileNameChange, onNewFileSubmit, onNewFileCancel }: TreeNodeProps) {
  const expandedDirs = useSearchStore((s) => s.expandedDirs);
  const toggleDir = useSearchStore((s) => s.toggleDir);
  const moveFile = useSearchStore((s) => s.moveFile);
  const renameFile = useSearchStore((s) => s.renameFile);
  const [hovered, setHovered] = React.useState(false);
  const [dragOver, setDragOver] = React.useState(false);
  const [renaming, setRenaming] = React.useState(false);
  const [renameValue, setRenameValue] = React.useState('');
  const lastClickRef = React.useRef(0);
  const renameInputRef = React.useRef<HTMLInputElement>(null);

  const isExpanded = expandedDirs.has(entry.path);
  const paddingLeft = 8 + depth * 16;

  const handleStartRename = () => {
    setRenaming(true);
    setRenameValue(entry.name);
    setTimeout(() => renameInputRef.current?.focus(), 0);
  };

  const handleRenameSubmit = async () => {
    setRenaming(false);
    if (renameValue.trim() && renameValue !== entry.name) {
      try {
        await renameFile(wsId, entry.path, renameValue.trim());
      } catch {
        // ignore
      }
    }
  };

  const handleClick = () => {
    if (renaming) return;
    if (entry.is_dir) {
      toggleDir(entry.path);
      return;
    }
    const now = Date.now();
    if (now - lastClickRef.current < 400) {
      handleStartRename();
      lastClickRef.current = 0;
    } else {
      lastClickRef.current = now;
      onFileClick(entry.path, entry.name);
    }
  };

  const handleDirDoubleCheck = () => {
    if (renaming) return;
    const now = Date.now();
    if (now - lastClickRef.current < 400) {
      handleStartRename();
      lastClickRef.current = 0;
    } else {
      lastClickRef.current = now;
      toggleDir(entry.path);
    }
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', entry.path);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const fromPath = e.dataTransfer.getData('text/plain');
    if (!fromPath || !entry.is_dir || fromPath === entry.path) return;
    const fileName = fromPath.split('/').pop() || fromPath;
    const toPath = `${entry.path}/${fileName}`;
    moveFile(wsId, fromPath, toPath);
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!entry.is_dir) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  const showNewFileInput = newFileInput && newFileInput.parentPath === entry.path && entry.is_dir && isExpanded;

  if (entry.is_dir) {
    return (
      <>
        <div
          onClick={handleDirDoubleCheck}
          onContextMenu={(e) => onContextMenu(e, entry.path, true)}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          draggable
          onDragStart={handleDragStart}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: `3px var(--space-2) 3px ${paddingLeft}px`,
            cursor: 'pointer',
            background: dragOver ? 'rgba(45,212,191,0.1)' : hovered ? 'var(--bg-hover)' : 'transparent',
            fontSize: '12px',
            userSelect: 'none',
          }}
        >
          {isExpanded ? (
            <ChevronDown size={12} style={{ flexShrink: 0, color: 'var(--text-disabled)' }} />
          ) : (
            <ChevronRight size={12} style={{ flexShrink: 0, color: 'var(--text-disabled)' }} />
          )}
          {isExpanded ? (
            <FolderOpen size={12} style={{ flexShrink: 0, color: 'var(--text-tertiary)' }} />
          ) : (
            <Folder size={12} style={{ flexShrink: 0, color: 'var(--text-tertiary)' }} />
          )}
          {renaming ? (
            <input
              ref={renameInputRef}
              style={inlineInputStyle}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleRenameSubmit(); if (e.key === 'Escape') setRenaming(false); }}
              onBlur={handleRenameSubmit}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span style={{ color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {entry.name}
            </span>
          )}
        </div>
        {isExpanded && (
          <>
            {showNewFileInput && (
              <NewFileInlineInput
                depth={depth + 1}
                value={newFileName}
                onChange={onNewFileNameChange}
                onSubmit={onNewFileSubmit}
                onCancel={onNewFileCancel}
              />
            )}
            {entry.children?.map((child) => (
              <TreeNode
                key={child.path}
                entry={child}
                depth={depth + 1}
                onFileClick={onFileClick}
                onContextMenu={onContextMenu}
                wsId={wsId}
                newFileInput={newFileInput}
                newFileName={newFileName}
                onNewFileNameChange={onNewFileNameChange}
                onNewFileSubmit={onNewFileSubmit}
                onNewFileCancel={onNewFileCancel}
              />
            ))}
          </>
        )}
      </>
    );
  }

  return (
    <div
      onClick={handleClick}
      onContextMenu={(e) => onContextMenu(e, entry.path, false)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      draggable
      onDragStart={handleDragStart}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        padding: `3px var(--space-2) 3px ${paddingLeft + 16}px`,
        cursor: 'pointer',
        background: hovered ? 'var(--bg-hover)' : 'transparent',
        fontSize: '12px',
      }}
    >
      <File size={12} style={{ flexShrink: 0, color: 'var(--text-disabled)' }} />
      {renaming ? (
        <input
          ref={renameInputRef}
          style={inlineInputStyle}
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleRenameSubmit(); if (e.key === 'Escape') setRenaming(false); }}
          onBlur={handleRenameSubmit}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span style={{ color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {entry.name}
        </span>
      )}
    </div>
  );
}

function FileResult({ path, name, size, onClick }: { path: string; name: string; size: number; onClick: () => void }) {
  const [hovered, setHovered] = React.useState(false);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        padding: '4px var(--space-3)',
        cursor: 'pointer',
        background: hovered ? 'var(--bg-hover)' : 'transparent',
        fontSize: '12px',
      }}
    >
      <File size={12} style={{ flexShrink: 0, color: 'var(--text-disabled)' }} />
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <div style={{ color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {name}
        </div>
        <div style={{ color: 'var(--text-disabled)', fontSize: '10px', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {path}
        </div>
      </div>
      <span style={{ flexShrink: 0, color: 'var(--text-disabled)', fontSize: '10px', fontFamily: 'var(--font-mono)' }}>
        {formatSize(size)}
      </span>
    </div>
  );
}
