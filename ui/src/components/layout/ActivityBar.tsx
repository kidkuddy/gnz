import React from 'react';
import { Database, Settings } from 'lucide-react';

interface ActivityBarProps {
  activeModule: string;
  onModuleChange: (moduleId: string) => void;
}

const containerStyle: React.CSSProperties = {
  gridArea: 'activity-bar',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  paddingTop: 'var(--space-2)',
  gap: 'var(--space-1)',
  background: 'var(--bg-surface)',
  borderRight: '1px solid var(--border-subtle)',
  width: 'var(--activity-bar-width)',
};

const modules = [
  { id: 'database', icon: Database, label: 'Database' },
  { id: 'settings', icon: Settings, label: 'Settings' },
];

export function ActivityBar({ activeModule, onModuleChange }: ActivityBarProps) {
  return (
    <div style={containerStyle}>
      {modules.map((mod) => (
        <ActivityBarItem
          key={mod.id}
          icon={mod.icon}
          label={mod.label}
          isActive={activeModule === mod.id}
          onClick={() => onModuleChange(mod.id)}
        />
      ))}
    </div>
  );
}

interface ActivityBarItemProps {
  icon: React.ComponentType<{ size: number; strokeWidth?: number }>;
  label: string;
  isActive: boolean;
  onClick: () => void;
}

function ActivityBarItem({ icon: Icon, label, isActive, onClick }: ActivityBarItemProps) {
  const [hovered, setHovered] = React.useState(false);

  const itemStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '36px',
    height: '36px',
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
    position: 'relative',
    color: isActive ? 'var(--accent-text)' : hovered ? 'var(--text-primary)' : 'var(--text-tertiary)',
    background: isActive ? 'var(--accent-muted)' : hovered ? 'var(--bg-hover)' : 'transparent',
    transition: 'all 120ms ease',
  };

  const indicatorStyle: React.CSSProperties = {
    position: 'absolute',
    left: '-6px',
    width: '3px',
    height: '16px',
    borderRadius: '0 2px 2px 0',
    background: 'var(--accent)',
    opacity: isActive ? 1 : 0,
    transition: 'opacity 120ms ease',
  };

  return (
    <button
      style={itemStyle}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={label}
    >
      <span style={indicatorStyle} />
      <Icon size={18} strokeWidth={1.5} />
    </button>
  );
}
