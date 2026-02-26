import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            background: '#0a0a0b',
            color: '#ef4444',
            fontFamily: 'monospace',
            padding: '32px',
            gap: '16px',
          }}
        >
          <div style={{ fontSize: '14px', fontWeight: 600 }}>Something crashed</div>
          <pre
            style={{
              fontSize: '12px',
              color: '#a1a1aa',
              maxWidth: '600px',
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
              background: '#111113',
              padding: '16px',
              borderRadius: '6px',
              border: '1px solid #27272a',
            }}
          >
            {this.state.error.message}
            {'\n\n'}
            {this.state.error.stack}
          </pre>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => {
                const text = `${this.state.error!.message}\n\n${this.state.error!.stack || ''}`;
                navigator.clipboard.writeText(text);
              }}
              style={{
                padding: '8px 16px',
                background: '#18181b',
                border: '1px solid #27272a',
                borderRadius: '4px',
                color: '#fafafa',
                cursor: 'pointer',
                fontSize: '12px',
              }}
            >
              Copy Error
            </button>
            <button
              onClick={() => this.setState({ error: null })}
              style={{
                padding: '8px 16px',
                background: '#18181b',
                border: '1px solid #27272a',
                borderRadius: '4px',
                color: '#fafafa',
                cursor: 'pointer',
                fontSize: '12px',
              }}
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
