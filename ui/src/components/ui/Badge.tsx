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
    background: 'rgba(255, 255, 255, 0.04)',
    color: 'var(--text-secondary)',
  },
  error: {
    background: 'rgba(255, 255, 255, 0.04)',
    color: 'var(--text-secondary)',
  },
  warning: {
    background: 'rgba(255, 255, 255, 0.04)',
    color: 'var(--text-secondary)',
  },
  info: {
    background: 'rgba(255, 255, 255, 0.04)',
    color: 'var(--text-secondary)',
  },
  accent: {
    background: 'var(--accent-muted)',
    color: 'var(--text-primary)',
  },
};

export function Badge({ variant = 'default', children, style }: BadgeProps) {
  const baseStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '1px 8px',
    fontSize: '11px',
    fontFamily: 'var(--font-mono)',
    fontWeight: 400,
    borderRadius: '2px',
    lineHeight: '18px',
    letterSpacing: '0.01em',
    ...variantStyles[variant],
    ...style,
  };

  return <span style={baseStyle}>{children}</span>;
}
