import React from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { useTabStore } from '../../../stores/tab-store';
import { useWorkspaceStore } from '../../../stores/workspace-store';
import { useTerminalStore } from '../stores/terminal-store';
import { getBackendPort, terminalApi } from '../../../lib/tauri-ipc';

export function TerminalView() {
  const activeTabId = useTabStore((s) => s.activeTabId);
  const tabs = useTabStore((s) => s.tabs);
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace);

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const sessionId = activeTab?.data?.sessionId as string | undefined;

  React.useEffect(() => {
    if (activeWorkspace) {
      useTerminalStore.getState().loadSessions(activeWorkspace.id).catch(() => {});
    }
  }, [activeWorkspace]);

  React.useEffect(() => {
    if (sessionId) {
      useTerminalStore.getState().setActiveSession(sessionId);
    }
  }, [sessionId]);

  if (!sessionId || !activeWorkspace) {
    return (
      <div style={emptyStyle}>
        <span>Open or create a terminal from the panel</span>
      </div>
    );
  }

  return <TerminalInstance key={sessionId} sessionId={sessionId} workspaceId={activeWorkspace.id} />;
}

function TerminalInstance({ sessionId, workspaceId }: { sessionId: string; workspaceId: string }) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const termRef = React.useRef<Terminal | null>(null);
  const fitRef = React.useRef<FitAddon | null>(null);
  const esRef = React.useRef<EventSource | null>(null);

  React.useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: 'var(--font-mono), JetBrains Mono, Menlo, Monaco, monospace',
      theme: {
        background: '#0a0a0b',
        foreground: '#e4e4e7',
        cursor: '#2dd4bf',
        selectionBackground: '#2dd4bf33',
        black: '#18181b',
        red: '#ef4444',
        green: '#22c55e',
        yellow: '#eab308',
        blue: '#3b82f6',
        magenta: '#a855f7',
        cyan: '#2dd4bf',
        white: '#e4e4e7',
        brightBlack: '#52525b',
        brightRed: '#f87171',
        brightGreen: '#4ade80',
        brightYellow: '#facc15',
        brightBlue: '#60a5fa',
        brightMagenta: '#c084fc',
        brightCyan: '#5eead4',
        brightWhite: '#fafafa',
      },
      allowTransparency: true,
      scrollback: 5000,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);

    termRef.current = term;
    fitRef.current = fitAddon;

    // Fit after a frame to ensure container has dimensions
    requestAnimationFrame(() => {
      fitAddon.fit();
      sendResize(workspaceId, sessionId, term.cols, term.rows);
    });

    // Handle user input → POST to backend
    const inputDisposable = term.onData((data) => {
      const encoded = btoa(data);
      terminalApi.input(workspaceId, sessionId, encoded).catch(() => {});
    });

    // Connect SSE for output
    let es: EventSource | null = null;
    getBackendPort().then((port) => {
      const url = `http://127.0.0.1:${port}/api/v1/workspaces/${workspaceId}/terminals/${sessionId}/stream`;
      es = new EventSource(url);
      esRef.current = es;

      es.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          if (parsed.output) {
            const decoded = atob(parsed.output);
            term.write(decoded);
          }
        } catch {
          // Skip unparseable
        }
      };

      es.addEventListener('done', () => {
        term.write('\r\n\x1b[90m[Process exited]\x1b[0m\r\n');
        es?.close();
      });

      es.addEventListener('error', () => {
        // EventSource reconnects automatically; only close if terminal is gone
      });
    });

    // Resize observer
    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        if (fitRef.current && termRef.current) {
          fitRef.current.fit();
          sendResize(workspaceId, sessionId, termRef.current.cols, termRef.current.rows);
        }
      });
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      inputDisposable.dispose();
      resizeObserver.disconnect();
      es?.close();
      esRef.current = null;
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
  }, [sessionId, workspaceId]);

  return <div ref={containerRef} style={termContainerStyle} />;
}

let resizeTimeout: ReturnType<typeof setTimeout> | null = null;

function sendResize(workspaceId: string, sessionId: string, cols: number, rows: number) {
  if (resizeTimeout) clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    terminalApi.resize(workspaceId, sessionId, cols, rows).catch(() => {});
  }, 100);
}

const emptyStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  color: 'var(--text-disabled)',
  fontFamily: 'var(--font-mono)',
  fontSize: '13px',
};

const termContainerStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  padding: '4px',
  background: '#0a0a0b',
};
