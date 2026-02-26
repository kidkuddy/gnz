import React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { ChevronDown, Check } from 'lucide-react';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  label?: string;
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
}

const labelStyle: React.CSSProperties = {
  fontSize: '12px',
  fontWeight: 400,
  color: 'var(--text-secondary)',
  letterSpacing: '0.02em',
  marginBottom: 'var(--space-1)',
  display: 'block',
};

const triggerStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  width: '100%',
  height: '30px',
  padding: '0 var(--space-3)',
  background: 'var(--bg-elevated)',
  border: 'none',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text-primary)',
  fontSize: '13px',
  fontFamily: 'var(--font-sans)',
  cursor: 'pointer',
  outline: 'none',
  gap: 'var(--space-2)',
};

const contentStyle: React.CSSProperties = {
  background: '#0a0a0a',
  borderRadius: 'var(--radius-sm)',
  padding: 'var(--space-1)',
  zIndex: 200,
  minWidth: 'var(--radix-select-trigger-width)',
  overflow: 'hidden',
};

const itemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
  padding: '6px var(--space-3)',
  fontSize: '13px',
  color: 'var(--text-primary)',
  borderRadius: 'var(--radius-sm)',
  cursor: 'pointer',
  outline: 'none',
  userSelect: 'none',
};

export function Select({ label, value, onValueChange, options, placeholder }: SelectProps) {
  return (
    <div>
      {label && <span style={labelStyle}>{label}</span>}
      <SelectPrimitive.Root value={value} onValueChange={onValueChange}>
        <SelectPrimitive.Trigger style={triggerStyle}>
          <SelectPrimitive.Value placeholder={placeholder} />
          <SelectPrimitive.Icon>
            <ChevronDown size={14} color="var(--text-tertiary)" />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Content style={contentStyle} position="popper" sideOffset={4}>
            <SelectPrimitive.Viewport>
              {options.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectPrimitive.Viewport>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
    </div>
  );
}

const SelectItem = React.forwardRef<
  HTMLDivElement,
  SelectPrimitive.SelectItemProps & { children: React.ReactNode }
>(({ children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    style={itemStyle}
    onMouseEnter={(e) => {
      (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)';
    }}
    onMouseLeave={(e) => {
      (e.currentTarget as HTMLElement).style.background = 'transparent';
    }}
    {...props}
  >
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    <SelectPrimitive.ItemIndicator>
      <Check size={12} color="var(--text-primary)" />
    </SelectPrimitive.ItemIndicator>
  </SelectPrimitive.Item>
));
SelectItem.displayName = 'SelectItem';
