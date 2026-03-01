import React from 'react';

interface Props {
  children: React.ReactNode;
  label: string;
}

interface State {
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

/**
 * Diagnostic error boundary for galacta components.
 * Catches render errors and displays the full (unminified) message + component stack.
 */
export class GalactaErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`[galacta:${this.props.label}] React render error:`, error);
    console.error(`[galacta:${this.props.label}] Component stack:`, errorInfo.componentStack);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            padding: 16,
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: '#d46',
            background: 'rgba(200, 60, 60, 0.04)',
            height: '100%',
            overflow: 'auto',
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 8 }}>
            [{this.props.label}] Render error
          </div>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginBottom: 12, color: '#f88' }}>
            {this.state.error.message}
          </pre>
          {this.state.errorInfo?.componentStack && (
            <>
              <div style={{ fontWeight: 600, marginBottom: 4, color: 'var(--text-tertiary)' }}>
                Component stack:
              </div>
              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: 'var(--text-tertiary)', fontSize: 10 }}>
                {this.state.errorInfo.componentStack}
              </pre>
            </>
          )}
          <button
            onClick={() => this.setState({ error: null, errorInfo: null })}
            style={{
              marginTop: 12,
              padding: '6px 16px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid rgba(200, 60, 60, 0.3)',
              background: 'rgba(200, 60, 60, 0.08)',
              color: '#c66',
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
            }}
          >
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
