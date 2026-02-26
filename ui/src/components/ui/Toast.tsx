import { Toaster } from 'sonner';

export function Toast() {
  return (
    <Toaster
      theme="dark"
      position="bottom-right"
      toastOptions={{
        style: {
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-default)',
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-sans)',
          fontSize: '13px',
        },
      }}
    />
  );
}
