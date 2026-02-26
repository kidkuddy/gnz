import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

const wrapperStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-1)',
};

const labelStyle: React.CSSProperties = {
  fontSize: '12px',
  fontWeight: 400,
  color: 'var(--text-secondary)',
  letterSpacing: '0.02em',
};

const baseInputStyle: React.CSSProperties = {
  height: '30px',
  padding: '0 var(--space-3)',
  background: 'var(--bg-elevated)',
  border: 'none',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text-primary)',
  fontSize: '13px',
  fontFamily: 'var(--font-sans)',
  transition: 'background 100ms ease',
  outline: 'none',
  width: '100%',
};

export function Input({ label, style, ...props }: InputProps) {
  const [focused, setFocused] = React.useState(false);

  const inputStyle: React.CSSProperties = {
    ...baseInputStyle,
    background: focused ? 'var(--bg-hover)' : 'var(--bg-elevated)',
    ...style,
  };

  return (
    <div style={wrapperStyle}>
      {label && <label style={labelStyle}>{label}</label>}
      <input
        style={inputStyle}
        onFocus={(e) => {
          setFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          props.onBlur?.(e);
        }}
        {...props}
      />
    </div>
  );
}
