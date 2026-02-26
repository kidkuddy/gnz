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
            background: '#000000',
            color: '#6b6b6b',
            fontFamily: 'monospace',
            padding: '32px',
            gap: '16px',
          }}
        >
          <div style={{ fontSize: '14px', fontWeight: 500, color: '#d4d4d4' }}>Something crashed</div>
          <pre
            style={{
              fontSize: '12px',
              color: '#6b6b6b',
              maxWidth: '600px',
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
              background: '#0a0a0a',
              padding: '16px',
              borderRadius: '3px',
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
                background: '#0a0a0a',
                border: 'none',
                borderRadius: '3px',
                color: '#d4d4d4',
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
                background: '#0a0a0a',
                border: 'none',
                borderRadius: '3px',
                color: '#d4d4d4',
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
