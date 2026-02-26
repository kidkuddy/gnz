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
    background: 'var(--text-primary)',
    color: '#000000',
    fontWeight: 500,
  },
  secondary: {
    background: 'transparent',
    color: 'var(--text-secondary)',
  },
  danger: {
    background: 'transparent',
    color: 'var(--status-error)',
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
    background: 'rgba(107, 58, 58, 0.15)',
  },
};

const sizeStyles: Record<ButtonSize, React.CSSProperties> = {
  sm: {
    padding: '4px 10px',
    fontSize: '12px',
    height: '26px',
  },
  md: {
    padding: '6px 14px',
    fontSize: '13px',
    height: '30px',
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
    borderRadius: 'var(--radius-sm)',
    fontFamily: 'var(--font-sans)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'all 100ms ease',
    whiteSpace: 'nowrap',
    opacity: disabled ? 0.3 : 1,
    border: 'none',
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
