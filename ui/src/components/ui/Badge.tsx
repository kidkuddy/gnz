import React from 'react';

type BadgeVariant = 'default' | 'success' | 'error' | 'warning' | 'info' | 'accent';

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  style?: React.CSSProperties;
}

const variantStyles: Record<BadgeVariant, React.CSSProperties> = {
  default: {
    background: 'var(--bg-hover)',
    color: 'var(--text-secondary)',
  },
  success: {
    background: 'rgba(34, 197, 94, 0.15)',
    color: 'var(--status-success)',
  },
  error: {
    background: 'rgba(239, 68, 68, 0.15)',
    color: 'var(--status-error)',
  },
  warning: {
    background: 'rgba(245, 158, 11, 0.15)',
    color: 'var(--status-warning)',
  },
  info: {
    background: 'rgba(59, 130, 246, 0.15)',
    color: 'var(--status-info)',
  },
  accent: {
    background: 'var(--accent-muted)',
    color: 'var(--accent-text)',
  },
};

export function Badge({ variant = 'default', children, style }: BadgeProps) {
  const baseStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '1px 8px',
    fontSize: '11px',
    fontFamily: 'var(--font-mono)',
    fontWeight: 500,
    borderRadius: '9999px',
    lineHeight: '18px',
    letterSpacing: '0.01em',
    ...variantStyles[variant],
    ...style,
  };

  return <span style={baseStyle}>{children}</span>;
}
