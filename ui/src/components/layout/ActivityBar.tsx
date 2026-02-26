import React from 'react';
import { useTabRegistry } from '../../stores/tab-registry';

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
  gap: '2px',
  background: 'var(--bg-base)',
  width: 'var(--activity-bar-width)',
};

export function ActivityBar({ activeModule, onModuleChange }: ActivityBarProps) {
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
    width: '34px',
    height: '34px',
    cursor: 'pointer',
    color: isActive ? 'var(--text-primary)' : hovered ? 'var(--text-secondary)' : 'var(--text-tertiary)',
    background: 'transparent',
    transition: 'color 100ms ease',
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
    </button>
  );
}
