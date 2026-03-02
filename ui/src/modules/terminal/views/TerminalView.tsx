import React from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { useWorkspaceStore } from '../../../stores/workspace-store';
import { useTerminalStore } from '../stores/terminal-store';
import { getBackendPort, terminalApi } from '../../../lib/tauri-ipc';
import type { Tab } from '../../../stores/tab-store';

interface Props {
  tab: Tab;
}

export function TerminalView({ tab }: Props) {
  const sessionId = tab.data?.sessionId as string | undefined;
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace);

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

  return <TerminalInstance sessionId={sessionId} workspaceId={activeWorkspace.id} />;
}

// Serialized input queue — ensures keystrokes arrive in order
class InputQueue {
  private queue: string[] = [];
  private sending = false;
  private ws: string;
  private sid: string;

  constructor(workspaceId: string, sessionId: string) {
    this.ws = workspaceId;
    this.sid = sessionId;
  }

  push(base64Data: string) {
    this.queue.push(base64Data);
    this.flush();
  }

  private async flush() {
    if (this.sending) return;
    this.sending = true;
    while (this.queue.length > 0) {
      const data = this.queue.shift()!;
      try {
        await terminalApi.input(this.ws, this.sid, data);
      } catch {
        // Terminal may be dead
      }
    }
    this.sending = false;
  }
}

function TerminalInstance({ sessionId, workspaceId }: { sessionId: string; workspaceId: string }) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const termRef = React.useRef<Terminal | null>(null);
  const fitRef = React.useRef<FitAddon | null>(null);
  const esRef = React.useRef<EventSource | null>(null);
  // Per-instance resize debounce — avoids multiple terminals stomping each other
  const resizeTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleFit = React.useCallback(() => {
    if (resizeTimeoutRef.current) clearTimeout(resizeTimeoutRef.current);
    resizeTimeoutRef.current = setTimeout(() => {
      // Double-rAF: first frame commits the layout, second frame gives correct dimensions
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const fit = fitRef.current;
          const term = termRef.current;
          const el = containerRef.current;
          if (!fit || !term || !el) return;
          // Skip if the container has no dimensions (still hidden)
          if (el.offsetWidth === 0 || el.offsetHeight === 0) return;
          fit.fit();
          term.refresh(0, term.rows - 1);
          terminalApi.resize(workspaceId, sessionId, term.cols, term.rows).catch(() => {});
        });
      });
    }, 50);
  }, [workspaceId, sessionId]);

  React.useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Menlo, Monaco, 'Courier New', monospace",
      macOptionIsMeta: true,
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

    scheduleFit();

    // Serialized input queue to prevent out-of-order keystrokes
    const inputQueue = new InputQueue(workspaceId, sessionId);

    const inputDisposable = term.onData((data) => {
      const bytes = new TextEncoder().encode(data);
      const encoded = uint8ToBase64(bytes);
      inputQueue.push(encoded);
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
            const bytes = base64ToUint8(parsed.output);
            term.write(bytes);
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
        // EventSource reconnects automatically
      });
    });

    // ResizeObserver covers container resizes and display:none → flex transitions.
    // Zero-dimension callbacks are filtered out inside scheduleFit.
    const resizeObserver = new ResizeObserver(() => scheduleFit());
    resizeObserver.observe(containerRef.current);

    return () => {
      if (resizeTimeoutRef.current) clearTimeout(resizeTimeoutRef.current);
      inputDisposable.dispose();
      resizeObserver.disconnect();
      es?.close();
      esRef.current = null;
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
  }, [sessionId, workspaceId, scheduleFit]);

  return <div ref={containerRef} style={termContainerStyle} />;
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToUint8(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
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
