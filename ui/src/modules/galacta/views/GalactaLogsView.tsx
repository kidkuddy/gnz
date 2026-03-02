import { useEffect, useRef, useState, useCallback } from 'react';
import { getBackendPort } from '../../../lib/tauri-ipc';

export function GalactaLogsView() {
  const [lines, setLines] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchLogs = useCallback(async () => {
    try {
      const port = await getBackendPort();
      const resp = await fetch(`http://127.0.0.1:${port}/api/v1/galacta/logs?lines=500`);
      const json = await resp.json();
      const data = json.data ?? json;
      if (data.error) {
        setError(data.error);
        setLines([]);
      } else {
        setError(null);
        setLines(data.lines ?? []);
      }
    } catch (err) {
      setError(String(err));
    }
  }, []);

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 3000);
    return () => clearInterval(interval);
  }, [fetchLogs]);

  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [lines, autoScroll]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 40);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div
        style={{
          padding: '6px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border-subtle)',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--text-tertiary)',
          }}
        >
          /tmp/galacta.log · {lines.length} lines
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={() => {
              setAutoScroll(true);
              if (containerRef.current) {
                containerRef.current.scrollTop = containerRef.current.scrollHeight;
              }
            }}
            style={{
              background: autoScroll ? 'var(--bg-active)' : 'none',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-sm)',
              padding: '2px 8px',
              color: autoScroll ? 'var(--accent)' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
            }}
          >
            auto-scroll
          </button>
          <button
            onClick={fetchLogs}
            style={{
              background: 'none',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-sm)',
              padding: '2px 8px',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
            }}
          >
            refresh
          </button>
        </div>
      </div>

      {/* Log content */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '8px 12px',
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          lineHeight: 1.6,
          color: 'var(--text-secondary)',
          whiteSpace: 'pre',
          tabSize: 4,
        }}
      >
        {error && (
          <div style={{ color: 'var(--text-tertiary)', padding: '16px 0' }}>
            {error}
          </div>
        )}
        {!error && lines.length === 0 && (
          <div style={{ color: 'var(--text-tertiary)', padding: '16px 0' }}>
            No log output yet.
          </div>
        )}
        {lines.map((line, i) => (
          <div key={i}>{line}</div>
        ))}
      </div>
    </div>
  );
}
