import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger';
type ButtonSize = 'sm' | 'md';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    background: 'var(--accent)',
    color: '#0a0a0b',
    fontWeight: 600,
  },
  secondary: {
    background: 'transparent',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border-default)',
  },
  danger: {
    background: 'transparent',
    color: 'var(--status-error)',
    border: '1px solid var(--status-error)',
  },
};

const variantHoverStyles: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    background: 'var(--accent-hover)',
  },
  secondary: {
    background: 'var(--bg-hover)',
    color: 'var(--text-primary)',
  },
  danger: {
    background: 'rgba(239, 68, 68, 0.1)',
  },
};

const sizeStyles: Record<ButtonSize, React.CSSProperties> = {
  sm: {
    padding: '4px 10px',
    fontSize: '12px',
    height: '28px',
  },
  md: {
    padding: '6px 14px',
    fontSize: '13px',
    height: '32px',
  },
};

export function Button({
  variant = 'secondary',
  size = 'md',
  children,
  style,
  disabled,
  ...props
}: ButtonProps) {
  const [hovered, setHovered] = React.useState(false);

  const baseStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 'var(--space-1)',
    borderRadius: 'var(--radius-md)',
    fontFamily: 'var(--font-sans)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'all 120ms ease',
    whiteSpace: 'nowrap',
    opacity: disabled ? 0.5 : 1,
    ...sizeStyles[size],
    ...variantStyles[variant],
    ...(hovered && !disabled ? variantHoverStyles[variant] : {}),
    ...style,
  };

  return (
    <button
      style={baseStyle}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      {...props}
    >
      {children}
    </button>
  );
}
