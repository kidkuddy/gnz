import React from 'react';
import { X } from 'lucide-react';
import { useTabStore, type Tab } from '../../stores/tab-store';

const containerStyle: React.CSSProperties = {
  gridArea: 'tabs',
  display: 'flex',
  alignItems: 'stretch',
  background: 'var(--bg-base)',
  height: 'var(--tabbar-height)',
  overflow: 'hidden',
};

const emptyStyle: React.CSSProperties = {
  flex: 1,
  background: 'var(--bg-base)',
};

export function TabBar() {
  const tabs = useTabStore((s) => s.tabs);
  const activeTabId = useTabStore((s) => s.activeTabId);
  const setActiveTab = useTabStore((s) => s.setActiveTab);
  const removeTab = useTabStore((s) => s.removeTab);
  const renameTab = useTabStore((s) => s.renameTab);

  return (
    <div style={containerStyle}>
      {tabs.map((tab) => (
        <TabItem
          key={tab.id}
          tab={tab}
          isActive={tab.id === activeTabId}
          onSelect={() => setActiveTab(tab.id)}
          onClose={() => removeTab(tab.id)}
          onRename={(title) => renameTab(tab.id, title)}
        />
      ))}
      <div style={emptyStyle} />
    </div>
  );
}

interface TabItemProps {
  tab: Tab;
  isActive: boolean;
  onSelect: () => void;
  onClose: () => void;
  onRename: (title: string) => void;
}

function TabItem({ tab, isActive, onSelect, onClose, onRename }: TabItemProps) {
  const [hovered, setHovered] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [editValue, setEditValue] = React.useState(tab.title);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commitRename = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== tab.title) {
      onRename(trimmed);
    } else {
      setEditValue(tab.title);
    }
    setEditing(false);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditValue(tab.title);
    setEditing(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      commitRename();
    } else if (e.key === 'Escape') {
      setEditValue(tab.title);
      setEditing(false);
    }
  };

  const tabStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-2)',
    padding: '0 var(--space-3)',
    height: '100%',
    fontSize: '12px',
    color: isActive ? 'var(--text-primary)' : hovered ? 'var(--text-secondary)' : 'var(--text-tertiary)',
    background: 'transparent',
    cursor: 'pointer',
    userSelect: 'none',
    position: 'relative',
    minWidth: 0,
    maxWidth: '200px',
    transition: 'color 80ms ease',
  };

  const titleStyle: React.CSSProperties = {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  };

  const inputStyle: React.CSSProperties = {
    background: 'var(--bg-elevated)',
    border: 'none',
    color: 'var(--text-primary)',
    fontSize: '12px',
    fontFamily: 'var(--font-sans)',
    padding: '0 4px',
    outline: 'none',
    width: '100%',
    minWidth: '60px',
    maxWidth: '160px',
  };

  const closeBtnStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '16px',
    height: '16px',
    color: 'var(--text-tertiary)',
    opacity: hovered || isActive ? 1 : 0,
    flexShrink: 0,
  };

  return (
    <div
      style={tabStyle}
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {editing ? (
        <input
          ref={inputRef}
          style={inputStyle}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commitRename}
          onKeyDown={handleKeyDown}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span style={titleStyle} onDoubleClick={handleDoubleClick}>
          {tab.title}
        </span>
      )}
      <button
        style={closeBtnStyle}
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      >
        <X size={11} />
      </button>
    </div>
  );
}
