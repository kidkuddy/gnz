interface CheckboxProps {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}

export function Checkbox({ checked, onChange, disabled }: CheckboxProps) {
  return (
    <button
      onClick={disabled ? undefined : onChange}
      aria-checked={checked}
      role="checkbox"
      style={{
        width: 13,
        height: 13,
        flexShrink: 0,
        border: `1px solid ${checked ? 'var(--text-tertiary)' : 'var(--border-strong)'}`,
        borderRadius: 2,
        background: checked ? 'var(--text-tertiary)' : 'transparent',
        cursor: disabled ? 'default' : 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
        transition: 'background 100ms ease, border-color 100ms ease',
        outline: 'none',
      }}
    >
      {checked && (
        <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
          <path d="M1 3L3 5L7 1" stroke="var(--bg-base)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}
