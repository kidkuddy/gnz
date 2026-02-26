import React from 'react';

interface PanelProps {
  children: React.ReactNode;
}

const containerStyle: React.CSSProperties = {
  gridArea: 'panel',
  display: 'flex',
  flexDirection: 'column',
  background: 'var(--bg-base)',
  width: 'var(--panel-width)',
  overflow: 'hidden',
};

export function Panel({ children }: PanelProps) {
  return <div style={containerStyle}>{children}</div>;
}

interface PanelSectionProps {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}

const sectionHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: 'var(--space-2) var(--space-3)',
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: '10px',
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'var(--text-tertiary)',
};

const sectionContentStyle: React.CSSProperties = {
  flex: 1,
  overflow: 'auto',
};

export function PanelSection({ title, action, children }: PanelSectionProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div style={sectionHeaderStyle}>
        <span style={sectionTitleStyle}>{title}</span>
        {action}
      </div>
      <div style={sectionContentStyle}>{children}</div>
    </div>
  );
}
