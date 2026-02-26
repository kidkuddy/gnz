import React from 'react';
import { X } from 'lucide-react';
import { useTabStore, type Tab } from '../../stores/tab-store';

const containerStyle: React.CSSProperties = {
  gridArea: 'tabs',
  display: 'flex',
  alignItems: 'stretch',
  background: 'var(--bg-surface)',
  borderBottom: '1px solid var(--border-subtle)',
  height: 'var(--tabbar-height)',
  overflow: 'hidden',
};

const emptyStyle: React.CSSProperties = {
  flex: 1,
  background: 'var(--bg-surface)',
};

export function TabBar() {
  const tabs = useTabStore((s) => s.tabs);
  const activeTabId = useTabStore((s) => s.activeTabId);
  const setActiveTab = useTabStore((s) => s.setActiveTab);
  const removeTab = useTabStore((s) => s.removeTab);

  return (
    <div style={containerStyle}>
      {tabs.map((tab) => (
        <TabItem
          key={tab.id}
          tab={tab}
          isActive={tab.id === activeTabId}
          onSelect={() => setActiveTab(tab.id)}
          onClose={() => removeTab(tab.id)}
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
}

function TabItem({ tab, isActive, onSelect, onClose }: TabItemProps) {
  const [hovered, setHovered] = React.useState(false);

  const tabStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-2)',
    padding: '0 var(--space-3)',
    height: '100%',
    fontSize: '12px',
    color: isActive ? 'var(--text-primary)' : 'var(--text-tertiary)',
    background: isActive ? 'var(--bg-base)' : hovered ? 'var(--bg-hover)' : 'transparent',
    borderRight: '1px solid var(--border-subtle)',
    cursor: 'pointer',
    userSelect: 'none',
    position: 'relative',
    minWidth: 0,
    maxWidth: '180px',
    transition: 'background 80ms ease',
  };

  const activeIndicator: React.CSSProperties = {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '2px',
    background: 'var(--accent)',
    opacity: isActive ? 1 : 0,
  };

  const titleStyle: React.CSSProperties = {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  };

  const closeBtnStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '16px',
    height: '16px',
    borderRadius: 'var(--radius-sm)',
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
      <span style={titleStyle}>{tab.title}</span>
      <button
        style={closeBtnStyle}
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      >
        <X size={12} />
      </button>
      <span style={activeIndicator} />
    </div>
  );
}
