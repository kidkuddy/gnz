import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0, 0, 0, 0.6)',
  backdropFilter: 'blur(4px)',
  zIndex: 100,
  animation: 'fadeIn 150ms ease',
};

const contentStyle: React.CSSProperties = {
  position: 'fixed',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-lg)',
  padding: 'var(--space-6)',
  minWidth: '420px',
  maxWidth: '560px',
  maxHeight: '85vh',
  overflowY: 'auto',
  zIndex: 101,
  animation: 'scaleIn 150ms ease',
};

const titleStyle: React.CSSProperties = {
  fontSize: '15px',
  fontWeight: 600,
  color: 'var(--text-primary)',
  marginBottom: 'var(--space-1)',
};

const descriptionStyle: React.CSSProperties = {
  fontSize: '13px',
  color: 'var(--text-tertiary)',
  marginBottom: 'var(--space-5)',
};

const closeBtnStyle: React.CSSProperties = {
  position: 'absolute',
  top: 'var(--space-4)',
  right: 'var(--space-4)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '24px',
  height: '24px',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text-tertiary)',
  cursor: 'pointer',
};

export function Modal({ open, onOpenChange, title, description, children }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay style={overlayStyle} />
        <Dialog.Content style={contentStyle}>
          <Dialog.Title style={titleStyle}>{title}</Dialog.Title>
          {description && (
            <Dialog.Description style={descriptionStyle}>{description}</Dialog.Description>
          )}
          {children}
          <Dialog.Close asChild>
            <button style={closeBtnStyle} aria-label="Close">
              <X size={14} />
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
