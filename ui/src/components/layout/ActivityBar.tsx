import React from 'react';
import { useTabRegistry } from '../../stores/tab-registry';

interface ActivityBarProps {
  activeModule: string;
  onModuleChange: (moduleId: string) => void;
  badges?: Record<string, boolean>;
}

const containerStyle: React.CSSProperties = {
  gridArea: 'activity-bar',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  paddingTop: 'var(--space-2)',
  gap: '2px',
  background: 'var(--bg-base)',
  width: 'var(--activity-bar-width)',
};

export function ActivityBar({ activeModule, onModuleChange, badges }: ActivityBarProps) {
  const registry = useTabRegistry();
  const modules = registry.getModules();

  return (
    <div style={containerStyle}>
      {modules.map((mod) => (
        <ActivityBarItem
          key={mod.id}
          icon={mod.icon}
          label={mod.label}
          isActive={activeModule === mod.id}
          hasBadge={badges?.[mod.id] ?? false}
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
  hasBadge: boolean;
  onClick: () => void;
}

function ActivityBarItem({ icon: Icon, label, isActive, hasBadge, onClick }: ActivityBarItemProps) {
  const [hovered, setHovered] = React.useState(false);

  const itemStyle: React.CSSProperties = {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '34px',
    height: '34px',
    cursor: 'pointer',
    color: isActive ? 'var(--text-primary)' : hovered ? 'var(--text-secondary)' : 'var(--text-tertiary)',
    background: 'transparent',
    transition: 'color 100ms ease',
  };

  const badgeStyle: React.CSSProperties = {
    position: 'absolute',
    top: '6px',
    right: '6px',
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    background: 'var(--accent, #2dd4bf)',
  };

  return (
    <button
      style={itemStyle}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={label}
    >
      <Icon size={17} strokeWidth={1.5} />
      {hasBadge && <span style={badgeStyle} />}
    </button>
  );
}
